import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AIRBNB_API_URL || "https://airbnbnew.cybersoft.edu.vn",
  headers: {
    "Content-Type": "application/json",
    TokenCybersoft: process.env.NEXT_PUBLIC_TOKEN_CYBERSOFT ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5Mb3AiOiJOb2RlanMgNTIiLCJIZXRIYW5TdHJpbmciOiIyNy8wNC8yMDI2IiwiSGV0SGFuVGltZSI6IjE3NzcyNDgwMDAwMDAiLCJuYmYiOjE3NTg5MDk2MDAsImV4cCI6MTc3NzM5OTIwMH0._b9cEhCuhW5AQ7TsywHkbc2NkdJDSmQZYCxkjTSbv3I",
  },
  timeout: 10000,
});

// Flag để tránh redirect nhiều lần
let isRedirecting = false;

// Request interceptor để tự động thêm token vào header
api.interceptors.request.use(
  (config) => {
    // 🧠 Chỉ chạy khi có window và localStorage
    if (typeof window !== "undefined" && localStorage) {
      const token = localStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor để xử lý lỗi
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("API Error:", error.response?.data || error.message);
    console.error("API Error Status:", error.response?.status);
    console.error("API Error Headers:", error.config?.headers);
    
    // Log token info để debug
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("authToken");
      console.log("🔑 Token in localStorage:", token ? "Exists" : "Missing");
      if (token) {
        console.log("🔑 Token length:", token.length);
        console.log("🔑 Token preview:", token.substring(0, 20) + "...");
      }
    }
    
    // Giữ nguyên error object để có thể truy cập error.response sau này
    if (error.response) {
      const { status, data } = error.response;
      const errorMessage = data?.message || data?.content || error.message;
      
      // Tạo error mới nhưng giữ nguyên response
      const customError = new Error(errorMessage);
      customError.response = error.response;
      customError.status = status;
      
      switch (status) {
        case 400:
          customError.message = errorMessage || "Bad request. Please check your input.";
          break;
        case 401:
          // Token hết hạn hoặc không hợp lệ - xóa token và redirect
          if (typeof window !== "undefined" && !isRedirecting) {
            isRedirecting = true;
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
            // Chỉ redirect nếu không phải đang ở trang login
            if (!window.location.pathname.includes("/login")) {
              // Hiển thị thông báo thân thiện hơn
              const friendlyMessage = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
              
              // Hiển thị alert trước khi redirect (chỉ một lần)
              if (!document.querySelector('.token-expired-alert-shown')) {
                alert(friendlyMessage);
                document.body.setAttribute('data-token-expired', 'true');
              }
              
              setTimeout(() => {
                isRedirecting = false;
                window.location.href = "/login";
              }, 500);
            } else {
              isRedirecting = false;
            }
          }
          customError.message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
          break;
        case 403:
          // Kiểm tra nếu lỗi 403 liên quan đến token (hết hạn hoặc không hợp lệ)
          const isTokenError = 
            errorMessage?.toLowerCase().includes("token") ||
            errorMessage?.toLowerCase().includes("hết hạn") ||
            errorMessage?.toLowerCase().includes("không đúng") ||
            errorMessage?.toLowerCase().includes("expired") ||
            errorMessage?.toLowerCase().includes("invalid");
          
          if (isTokenError && typeof window !== "undefined" && !isRedirecting) {
            isRedirecting = true;
            // Xóa token và user data nếu lỗi liên quan đến token
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
            // Chỉ redirect nếu không phải đang ở trang login
            if (!window.location.pathname.includes("/login")) {
              // Hiển thị thông báo thân thiện hơn (chỉ một lần)
              if (!document.querySelector('.token-expired-alert-shown')) {
                alert("Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.");
                document.body.setAttribute('data-token-expired', 'true');
              }
              
              setTimeout(() => {
                isRedirecting = false;
                window.location.href = "/login";
              }, 500);
            } else {
              isRedirecting = false;
            }
            customError.message = "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.";
          } else {
            customError.message = errorMessage || "Bạn không có quyền thực hiện hành động này.";
          }
          break;
        case 404:
          customError.message = errorMessage || "Resource not found.";
          break;
        case 500:
          customError.message = errorMessage || "Server error. Please try again later.";
          break;
        default:
          customError.message = errorMessage || "An unexpected error occurred.";
      }
      
      throw customError;
    } else if (error.request) {
      throw new Error("Network error. Please check your connection.");
    } else {
      throw error;
    }
  }
);

export default api;
