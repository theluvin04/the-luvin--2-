// config/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Thêm cái này để lưu đơn hàng
import { getStorage } from "firebase/storage";     // Thêm cái này để lưu ảnh

// Thông tin cấu hình của bạn (đã điền sẵn)
const firebaseConfig = {
  apiKey: "AIzaSyCEEblAsaEQPDGeEO7PLrzDLfpa7Z8O1ss",
  authDomain: "the-luvin.firebaseapp.com",
  projectId: "the-luvin",
  storageBucket: "the-luvin.appspot.com",
  messagingSenderId: "280180645664",
  appId: "1:280180645664:web:616b7a84d214629e064145",
  measurementId: "G-1E58PMLPRP"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Xuất ra các công cụ để dùng ở nơi khác
export const db = getFirestore(app);
export const storage = getStorage(app);