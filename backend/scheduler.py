"""
Scheduler — APScheduler
========================
Gestiona los jobs de recordatorio por email.
Un job por cita: se dispara 24h antes de la cita.
Si la cita se cancela, el job se elimina.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.memory import MemoryJobStore
from datetime import datetime, timedelta
import pytz

# Use Santiago timezone for Chilean barber shops
TZ = pytz.timezone("America/Santiago")

scheduler = BackgroundScheduler(
    jobstores={"default": MemoryJobStore()},
    timezone=TZ,
)


def start():
    if not scheduler.running:
        scheduler.start()
        print("[SCHEDULER] Started")


def stop():
    if scheduler.running:
        scheduler.shutdown(wait=False)


def schedule_reminder(
    appointment_id: str,
    appointment_date: str,   # "2024-12-25"
    appointment_time: str,   # "15:30"
    callback,                # callable — called with no args
) -> bool:
    """
    Schedule a reminder to fire 24h before the appointment.
    Returns True if scheduled, False if appointment is too soon (< 2h from now).
    """
    try:
        appt_dt = datetime.strptime(
            f"{appointment_date} {appointment_time}", "%Y-%m-%d %H:%M"
        )
        appt_dt = TZ.localize(appt_dt)
        fire_at = appt_dt - timedelta(hours=24)
        now = datetime.now(TZ)

        if fire_at <= now:
            # Appointment is within 24h — send reminder immediately if > 30min away
            if appt_dt - now > timedelta(minutes=30):
                fire_at = now + timedelta(seconds=5)
            else:
                print(f"[SCHEDULER] Appointment {appointment_id} too soon, skipping reminder")
                return False

        job_id = f"reminder_{appointment_id}"
        scheduler.add_job(
            callback,
            trigger="date",
            run_date=fire_at,
            id=job_id,
            replace_existing=True,
            misfire_grace_time=3600,   # fire up to 1h late if server was down
        )
        print(f"[SCHEDULER] Reminder scheduled for {appointment_id} at {fire_at.isoformat()}")
        return True
    except Exception as e:
        print(f"[SCHEDULER] Error scheduling {appointment_id}: {e}")
        return False


def cancel_reminder(appointment_id: str):
    job_id = f"reminder_{appointment_id}"
    try:
        scheduler.remove_job(job_id)
        print(f"[SCHEDULER] Reminder cancelled: {appointment_id}")
    except Exception:
        pass  # Job may not exist


def schedule_interval(job_id: str, callback, hours: int = 6):
    """
    Registra un job que se ejecuta cada N horas de forma indefinida.
    Si ya existe un job con ese ID, lo reemplaza.
    """
    try:
        scheduler.add_job(
            callback,
            trigger="interval",
            hours=hours,
            id=job_id,
            replace_existing=True,
            misfire_grace_time=3600,
        )
        print(f"[SCHEDULER] Interval job '{job_id}' registrado (cada {hours}h)")
    except Exception as e:
        print(f"[SCHEDULER] Error registrando interval job '{job_id}': {e}")


def list_jobs() -> list[dict]:
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
        })
    return jobs
