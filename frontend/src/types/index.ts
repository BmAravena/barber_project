export interface Tenant {
  id: string; slug: string; name: string;
  owner_name: string; owner_email: string;
  phone?: string; address?: string; city?: string;
  plan: string; active: number; created_at: string;
}
export interface Barber {
  id: string; username: string; full_name: string;
  bio?: string; specialty?: string; avatar?: string;
  instagram?: string; role?: string;
}
export interface Service {
  id: string; barber_id: string; name: string;
  description?: string; price: number; duration: number; active: number;
}
export interface PortfolioItem {
  id: string; barber_id: string; image: string; caption?: string; created_at: string;
}
export interface Appointment {
  id: string; barber_id: string; client_name: string; client_phone: string;
  client_email?: string; service_id: string; service_name: string;
  service_price: number; date: string; time: string;
  status: 'pending'|'confirmed'|'completed'|'cancelled'; notes?: string; created_at: string;
}
