// services/orderService.ts
import { db, storage } from '../config/firebase';
import { collection, setDoc, doc, getDoc, getDocs, query, orderBy, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { Order, FrameConfig, LegoPart } from '../types'; // Đã thêm FrameConfig, LegoPart
import { COLLECTION_TEMPLATES, LEGO_PARTS, FRAME_OPTIONS } from '../constants'; // Đã thêm constants

// Hàm phụ: Upload ảnh (Để đó sau này dùng)
const uploadImageToStorage = async (dataUrl: string, orderId: string, timestamp: number) => {
    try {
        const storageRef = ref(storage, `orders/${orderId}/preview_${timestamp}.png`);
        await uploadString(storageRef, dataUrl, 'data_url');
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Lỗi upload ảnh:", error);
        return null;
    }
};

// --- Helper function for quick price calculation (Định nghĩa lại để dùng nội bộ) ---
const getQuickPrice = (config: FrameConfig, allParts: Record<string, LegoPart>) => {
    const frame = FRAME_OPTIONS.find(f => f.id === config.frameId) || FRAME_OPTIONS[0];
    let total = frame.price;
    const CHARACTER_BASE_PRICE = 10000;

    total += config.characters.length * CHARACTER_BASE_PRICE;
    
    config.characters.forEach((char) => {
        total += char.customPrintPrice || 0;
        total += char.hair?.price || 0;
        total += char.hat?.price || 0;
        total += char.shirt?.price || 0;
        total += char.selectedShirtColor?.price || 0;
        total += char.pants?.price || 0;
        total += char.selectedPantsColor?.price || 0;
    });

    config.draggableItems.forEach(item => {
        // Cần tìm part trong LEGO_PARTS tổng hợp để lấy giá
        const part = allParts[item.partId] || LEGO_PARTS.accessory.find(p => p.id === item.partId) || LEGO_PARTS.pet.find(p => p.id === item.partId);
        if (part) {
            total += part.price;
        }
    });

    return total;
};
// -----------------------------------------------------------------------------------


// 1. Hàm tạo đơn hàng mới (LƯU Ý: ĐÃ CẬP NHẬT ĐỂ LƯU contactLink)
export const createOrder = async (order: Omit<Order, 'status' | 'contactLink'> & { contactLink?: string }) => {
    try {
        // Tắt upload ảnh tạm thời để tránh lỗi treo
        const itemsWithImages = await Promise.all(order.items.map(async (item) => {
            if (item.previewImageUrl && item.previewImageUrl.startsWith('data:image')) {
                // Thay vì upload, trả về rỗng để đơn hàng đi qua luôn
                return { ...item, previewImageUrl: "" }; 
            }
            return item;
        }));

        const finalOrder = {
            ...order,
            items: itemsWithImages,
            status: "Chờ thanh toán",
            internalNotes: "",
            isUrgent: false,
            adminDeadline: "",
            contactLink: order.contactLink || "", // --- MỚI: Thêm contactLink mặc định
            // --- QUAN TRỌNG: Lưu thời gian tạo chuẩn để Dashboard lọc được ---
            createdAt: new Date().toISOString()
        };

        // Lưu đơn hàng vào Firestore
        // @ts-ignore
        await setDoc(doc(db, "orders", order.id), finalOrder);

        return { success: true, data: finalOrder as Order };
    } catch (error) {
        console.error("Lỗi tạo đơn hàng:", error);
        return { success: false, error };
    }
};

// 2. Hàm tra cứu đơn hàng
export const getOrderById = async (orderId: string): Promise<Order | null> => {
    try {
        const docRef = doc(db, "orders", orderId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as Order) : null;
    } catch (error) {
        console.error("Lỗi lấy đơn hàng:", error);
        return null;
    }
};

// 3. Hàm lấy toàn bộ danh sách đơn hàng
export const getAllOrders = async (): Promise<Order[]> => {
    try {
        const q = query(collection(db, "orders"), orderBy("id", "desc")); 
        const querySnapshot = await getDocs(q);
        
        const orders: Order[] = [];
        querySnapshot.forEach((doc) => {
            orders.push(doc.data() as Order);
        });
        return orders;
    } catch (error) {
        console.error("Lỗi lấy danh sách đơn:", error);
        return [];
    }
};

// 4. Hàm cập nhật thông tin đơn hàng
export const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, updates);
        return true;
    } catch (error) {
        console.error("Lỗi cập nhật đơn hàng:", error);
        return false;
    }
};


// 5. HÀM ĐẶT ĐƠN HÀNG NHANH CHO ADMIN
export const adminQuickOrder = async () => {
    try {
        const orderId = `#TL${Date.now().toString().slice(-6)}`;
        const template = COLLECTION_TEMPLATES[0]; // Use 'Wedding Day' template
        const templateConfig = template.config;
        
        // Prepare all parts for price calculation
        const allParts: Record<string, LegoPart> = Object.values(LEGO_PARTS).flat().reduce((acc, part) => ({ ...acc, [part.id]: part }), {} as Record<string, LegoPart>);
        
        const subtotal = getQuickPrice(templateConfig, allParts);
        
        // Fixed shipping and payment for quick order (Standard shipping: 25000 VND)
        const SHIPPING_FEE = 25000;
        const FINAL_TOTAL_PRICE = subtotal + SHIPPING_FEE;
        const AMOUNT_TO_PAY = FINAL_TOTAL_PRICE; 
        
        const quickOrder: Order = {
            id: orderId,
            status: "Đã xác nhận", // Trạng thái mặc định là Đã xác nhận
            customer: {
                name: "Khách hàng Offline",
                phone: "0900000000",
                email: "offline@theluvin.com",
                address: "Ghi chú: Đơn đặt qua điện thoại/tin nhắn, cần kiểm tra địa chỉ chi tiết.",
            },
            delivery: {
                date: new Date().toISOString().split('T')[0],
                notes: "Đơn hàng nhanh Admin tự tạo.",
            },
            items: [{ ...templateConfig, previewImageUrl: template.imageUrl }],
            addGiftBox: false,
            shipping: {
                method: 'standard',
                fee: SHIPPING_FEE,
            },
            payment: {
                method: 'full',
            },
            totalPrice: FINAL_TOTAL_PRICE,
            amountToPay: AMOUNT_TO_PAY,
            
            // Thông tin Admin
            internalNotes: `[AUTO-GENERATED] Đơn hàng nhanh tạo bởi Admin (${new Date().toLocaleString()}).`,
            isUrgent: true, // Bật cờ Gấp
            adminDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Đặt deadline 1 tuần sau
            contactLink: "",
            createdAt: new Date().toISOString(),
        };

        // Lưu đơn hàng vào Firestore
        await setDoc(doc(db, "orders", orderId), quickOrder);

        return { success: true, data: quickOrder };
    } catch (error) {
        console.error("Lỗi tạo đơn hàng nhanh:", error);
        return { success: false, error };
    }
};