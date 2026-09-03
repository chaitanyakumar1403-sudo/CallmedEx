/**
 * The only place lucide-react is imported.
 *
 * Keeping the used set in one file makes the icon vocabulary reviewable and
 * keeps tree-shaking honest — a wildcard re-export would pull the whole set
 * into the bundle.
 */
export {
  MapPin, Navigation, TestTube, Syringe, Stethoscope, HeartPulse,
  Wallet, IndianRupee, ClipboardList, CheckCircle2, XCircle, AlertTriangle,
  Clock, Power, Bell, User, Users, LogOut, Settings, Camera, QrCode,
  Package, FlaskConical, FileText, Phone, ChevronRight, ChevronDown, X,
  Search, Plus, Trash2, Pencil, Eye, Download, RefreshCw, Menu, Building2,
  Mail, GraduationCap, ScanLine, Boxes, CalendarDays, Truck, ShieldCheck,
  Ban, BarChart3, CircleDot, ArrowRight, Award, Droplets, Tag, TrendingDown,
} from "lucide-react";
export type { LucideIcon } from "lucide-react";
