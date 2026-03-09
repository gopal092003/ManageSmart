import axios from "axios";
import { apiCallWithOfflineSupport } from "./services/offlineSync";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const getToken = () => localStorage.getItem("token");


export const api = axios.create({
  baseURL: API_URL,
  validateStatus: (status) => {
    return status >= 200 && status < 300;
  },
  timeout: 10000, // 10 second timeout
});

// Add auth header automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn("No auth token found");
    }
    return config;
  },
  (error) => {
    console.error("API Request Error:", error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized error - only redirect if not already on login/signup page
      const currentPath = window.location.pathname;
      if (currentPath !== "/login" && currentPath !== "/signup") {
        console.error("Unauthorized access, redirecting to login");
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Seat booking function with offline support
export const bookSeat = async ({ libraryId, seat, studentDetails }) => {
  try {
    console.log("Booking seat with details:", {
      libraryId,
      seat,
      studentDetails,
    });

    const response = await apiCallWithOfflineSupport(
      "POST",
      `/seats/${libraryId}/${seat.seatNumber}/book`,
      {
        name: studentDetails.name,
        rollNo: studentDetails.rollNo,
        contact: studentDetails.phone,
        email: studentDetails.email,
        shiftName: studentDetails.shiftName,
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error booking seat:", error);
    // If offline, queue the operation and return success
    if (!navigator.onLine) {
      return { message: "Seat booking queued for sync", offline: true };
    }
    throw error;
  }
};

// Function to delete a seat booking with offline support
export const deleteSeatBooking = async ({
  libraryId,
  seatNumber,
  shiftName,
}) => {
  try {
    console.log("Deleting seat booking:", { libraryId, seatNumber, shiftName });
    const response = await apiCallWithOfflineSupport(
      "DELETE",
      `/seats/${libraryId}/${seatNumber}/book/${shiftName}`
    );
    return response.data;
  } catch (error) {
    console.error("Error deleting seat booking:", error);
    // If offline, queue the operation and return success
    if (!navigator.onLine) {
      return { message: "Delete operation queued for sync", offline: true };
    }
    throw error;
  }
};

// Function to update student information with offline support
export const updateStudent = async ({
  libraryId,
  seatNumber,
  shiftName,
  studentDetails,
}) => {
  try {
    console.log("Updating student:", {
      libraryId,
      seatNumber,
      shiftName,
      studentDetails,
    });
    const response = await apiCallWithOfflineSupport(
      "PUT",
      `/seats/${libraryId}/${seatNumber}/book/${shiftName}`,
      {
        name: studentDetails.name,
        rollNo: studentDetails.rollNo,
        contact: studentDetails.phone,
        email: studentDetails.email,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating student:", error);
    // If offline, queue the operation and return success
    if (!navigator.onLine) {
      return { message: "Update operation queued for sync", offline: true };
    }
    throw error;
  }
};
