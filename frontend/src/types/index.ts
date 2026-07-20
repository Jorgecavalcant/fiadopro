
export type TransactionType = 'DEBT' | 'PAYMENT' | 'REFUND' | 'ABATIMENTO';
export type TransactionStatus = 'CONFIRMED' | 'PENDING' | 'REJECTED';
export type Language = 'en' | 'pt-BR';
export type OverpaymentStrategy = 'PROFIT' | 'RETURN';
export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'COMPENSATION';
export type PlanType = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface SubscriptionPlan {
  type: PlanType;
  maxCustomers: number;
  maxEvents: number;
  maxParticipantsPerEvent: number;
  hasAI: boolean;
  hasAds: boolean;
  monthlyPrice: number;
  expiresAt?: number;
}

export interface OwnerExpense {
  id: string;
  eventId: string;
  eventName: string;
  amount: number;
  description: string;
  date: number;
  isPaid: boolean;
  paidAt?: number;
  paymentMethod?: PaymentMethod;
}

export interface Donation {
  id: string;
  associationName: string;
  amount: number;
  date: number;
  receiptUrl?: string;
}

export interface UserCredentials {
  passwordHash: string;
  salt?: string;       // per-user random salt (PBKDF2); absent = legacy SHA-256
  userId?: string;     // stable identity across logins
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
  address?: string;
  pixKey?: string;
  defaultInterestRate?: number;
  /** Preenchido pelo backend (/api/auth/me). Nunca decidir autorização só com isto no frontend. */
  role?: 'user' | 'admin';
}

export interface CustomerNote {
  id: string;
  text: string;
  createdAt: number;
}

export interface TransactionAttachment {
  data: string;
  mimeType: string;
  name: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  amount: number;
  type: TransactionType;
  description: string;
  timestamp: number;
  dueDate?: number;
  paymentMethod?: PaymentMethod;
  eventId?: string;
  attachment?: TransactionAttachment;
  status: TransactionStatus;
  fromUserId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  installmentGroupId?: string;
  interestRate?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: CustomerNote[];
  createdAt: number;
  overpaymentStrategy?: OverpaymentStrategy;
  pixKey?: string;
  score?: number;
  trusted?: boolean;
  donations?: Donation[];
}

export interface CustomerWithBalance extends Customer {
  balance: number;
  rawBalance: number;
  lastActivity: number;
  isOverdue: boolean;
  score?: number;
}

export interface BillItem {
  id: string;
  name: string;
  price: number;
}

export interface Participant {
  id: string;
  name: string;
  itemIds: string[];
  isOwner?: boolean;
}

export interface Debt {
  id: string;
  customerId: string;
  eventId: string;
  amount: number;
  description: string;
  createdAt: number;
  isPaid: boolean;
}

export interface BillEvent {
  id: string;
  name: string;
  date: number;
  items: BillItem[];
  participants: Participant[];
  isCompleted: boolean;
  ownerParticipating: boolean;
}

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYMENT_CONFIRM' | 'PAYMENT_REJECT' | 'SPLIT_CONFIRMED';
export type AuditEntity = 'CUSTOMER' | 'TRANSACTION' | 'EVENT' | 'DEBT';

export interface AuditEntry {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  description: string;
}

export interface AppData {
  customers: Customer[];
  transactions: Transaction[];
  events: BillEvent[];
  language?: Language;
  isPro?: boolean;
  user?: User | null;
  debts?: Debt[];
  auditLog?: AuditEntry[];
  plan?: SubscriptionPlan;
  credentials?: UserCredentials;
  ownerExpenses?: OwnerExpense[];
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  CUSTOMERS = 'CUSTOMERS',
  CUSTOMER_DETAIL = 'CUSTOMER_DETAIL',
  INSIGHTS = 'INSIGHTS',
  SPLIT_BILL = 'SPLIT_BILL',
  EVENT_DETAIL = 'EVENT_DETAIL',
  NOTIFICATIONS = 'NOTIFICATIONS',
  TO_PAY = 'TO_PAY',
  DEBTORS_LIST = 'DEBTORS_LIST',
  RECEIVABLES_LIST = 'RECEIVABLES_LIST',
  PROFILE = 'PROFILE',
  AUDIT_LOG = 'AUDIT_LOG',
  MY_EXPENSES = 'MY_EXPENSES',
  SCORE_DETAIL = 'SCORE_DETAIL',
  CUSTOMER_MANAGEMENT = 'CUSTOMER_MANAGEMENT',
  HELP = 'HELP',
  INBOX = 'INBOX',
  MY_DEBTS = 'MY_DEBTS',
  ADMIN = 'ADMIN',
}
