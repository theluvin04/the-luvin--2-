// types.ts

// Danh sách các trang
export type Page = 'home' | 'builder' | 'collection' | 'feedback' | 'order-lookup' | 'contact' | 'cart' | 'checkout' | 'order-confirmation' | 'admin';

export interface FrameOption {
  id: string;
  name: string;
  frameWidthCm: number;
  frameHeightCm: number;
  backgroundWidthCm: number;
  backgroundHeightCm: number;
  price: number;
  imageUrl: string;
  description: string;
}

export interface OutfitColor {
  name: string;
  hex: string;
  imageUrl: string;
  price: number; 
}

export interface LegoPart {
  id: string;
  name: string;
  price: number; 
  imageUrl: string;
  type: 'hair' | 'face' | 'shirt' | 'pants' | 'accessory' | 'pet' | 'hat' | 'charm';
  widthCm: number;
  heightCm: number;
  colors?: OutfitColor[];
  attach?: { x: number; y: number }; 
  slices?: boolean; 
  dx?: number; 
  dy?: number; 
}

export interface LegoCharacterConfig {
  id: number;
  hair?: LegoPart;
  face?: LegoPart;
  shirt?: LegoPart;
  pants?: LegoPart;
  hat?: LegoPart;
  selectedShirtColor?: OutfitColor; 
  selectedPantsColor?: OutfitColor;
  customPrintPrice?: number;
  x: number; 
  y: number; 
  rotation: number; 
  scale: number; 
}

export interface TextConfig {
  id: number;
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  rotation: number;
}

export interface DraggableItem {
  id: number;
  type: 'accessory' | 'pet' | 'charm'; 
  partId: string; 
  x: number;
  y: number;
  scale: number;
  rotation: number;
  imageUrl?: string; 
}

export interface BackgroundConfig {
  type: 'color' | 'image' | 'upload';
  value: string;
}

export interface FrameConfig {
  frameId: string;
  background: BackgroundConfig;
  characters: LegoCharacterConfig[];
  texts: TextConfig[];
  draggableItems: DraggableItem[];
  previewImageUrl?: string;
}

export interface Order {
  id: string;
  status: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  delivery: {
    date: string;
    notes: string;
  };
  items: FrameConfig[];
  addGiftBox: boolean;
  shipping: {
    method: 'standard' | 'express' | 'bookship';
    fee: number;
  };
  payment: {
    method: 'deposit' | 'full';
  };
  totalPrice: number;
  amountToPay: number;
  
  // --- MỚI THÊM: Thông tin quản lý Admin ---
  internalNotes?: string; // Ghi chú nội bộ của Admin
  isUrgent?: boolean;     // Cờ đánh dấu đơn gấp thủ công
  adminDeadline?: string; // Deadline cho Admin
  contactLink?: string;   // Link liên hệ với khách hàng (Messenger, Zalo,...)
  
  // Thông tin bọc hàng (Mới)
  packerEmail?: string;
  packedAt?: string; // ISO String
  
  // Thời gian tạo đơn
  createdAt: string; 
}