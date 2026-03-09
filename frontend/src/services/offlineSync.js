import { api } from "../api";
import dbService from "./db";

// Check if online
export const isOnline = () => {
  return navigator.onLine;
};

// Listen for online/offline events
export const setupOnlineListener = (callback) => {
  window.addEventListener("online", () => {
    console.log("Internet connection restored");
    callback(true);
  });

  window.addEventListener("offline", () => {
    console.log("Internet connection lost");
    callback(false);
  });
};

// Sync pending operations when online
export const syncPendingOperations = async () => {
  if (!isOnline()) {
    console.log("Offline - cannot sync");
    return;
  }

  const pendingOps = await dbService.getPendingOperations();
  console.log(`Syncing ${pendingOps.length} pending operations...`);

  for (const op of pendingOps) {
    try {
      let response;
      
      switch (op.method) {
        case "POST":
          response = await api.post(op.endpoint, op.data);
          break;
        case "PUT":
          response = await api.put(op.endpoint, op.data);
          break;
        case "DELETE":
          response = await api.delete(op.endpoint);
          break;
        default:
          console.warn("Unknown method:", op.method);
          continue;
      }

      // Mark operation as complete
      await dbService.markOperationComplete(op.id);
      console.log(`Synced operation ${op.id}: ${op.method} ${op.endpoint}`);
    } catch (error) {
      console.error(`Error syncing operation ${op.id}:`, error);
      await dbService.markOperationFailed(op.id, op.retries);
    }
  }

  // After syncing, refresh data from server
  await syncDataFromServer();
};

// Sync data from server to IndexedDB
export const syncDataFromServer = async () => {
  if (!isOnline()) {
    console.log("Offline - cannot sync from server");
    return;
  }

  try {
    // Get library data
    const libraryRes = await api.get("/library/me");
    const libraryData = libraryRes.data;

    if (libraryData?.library) {
      // Save library to IndexedDB
      await dbService.saveLibrary(libraryData.library);

      // Get seats data
      const seatsRes = await api.get(`/seats/${libraryData.library._id}`);
      if (seatsRes.data?.seats) {
        await dbService.saveSeats(seatsRes.data.seats);
      }
    }
  } catch (error) {
    console.error("Error syncing data from server:", error);
    throw error;
  }
};

// Queue operation for later sync
export const queueOperation = async (method, endpoint, data) => {
  await dbService.addPendingOperation({
    type: "api_call",
    method,
    endpoint,
    data,
  });
  console.log(`Queued operation: ${method} ${endpoint}`);
};

// Make API call with offline support
export const apiCallWithOfflineSupport = async (method, endpoint, data = null) => {
  if (isOnline()) {
    try {
      // Try to make the API call
      let response;
      switch (method) {
        case "GET":
          response = await api.get(endpoint);
          break;
        case "POST":
          response = await api.post(endpoint, data);
          break;
        case "PUT":
          response = await api.put(endpoint, data);
          break;
        case "DELETE":
          response = await api.delete(endpoint);
          break;
        default:
          throw new Error(`Unknown method: ${method}`);
      }

      // If successful, sync data to IndexedDB (for GET requests or after mutations)
      if (response.data && (method === "GET" || method === "POST" || method === "PUT" || method === "DELETE")) {
        try {
          await syncDataFromServer();
        } catch (syncError) {
          console.error("Error syncing after operation:", syncError);
          // Don't fail the operation if sync fails
        }
      }

      return response;
    } catch (error) {
      // If network error and we're offline, queue the operation
      if (!error.response || error.code === "ECONNABORTED" || error.message === "Network Error") {
        if (!isOnline()) {
          console.log("Offline - queueing operation");
          await queueOperation(method, endpoint, data);
          // Return a mock success response for offline mode
          return { data: { message: "Operation queued for sync", offline: true } };
        }
      }
      throw error;
    }
  } else {
    // Offline - queue the operation
    console.log("Offline - queueing operation");
    await queueOperation(method, endpoint, data);
    // Return a mock success response for offline mode
    return { data: { message: "Operation queued for sync", offline: true } };
  }
};

// Get data with offline fallback
export const getDataWithOfflineFallback = async (getOnlineData, getOfflineData) => {
  if (isOnline()) {
    try {
      const data = await getOnlineData();
      // Also save to IndexedDB for offline access
      return data;
    } catch (error) {
      // If online but request fails, try offline data
      if (!error.response) {
        console.log("Network error - trying offline data");
        return await getOfflineData();
      }
      throw error;
    }
  } else {
    // Offline - use IndexedDB data
    console.log("Offline - using cached data");
    return await getOfflineData();
  }
};

// 🔴 ADD THIS FOR SEAT BOOKING OFFLINE SUPPORT
export const queueOfflineOperation = async ({ payload, operationId }) => {
  const { libraryId, seatNumber } = payload;

  await dbService.addPendingOperation({
    type: "BOOK_SEAT",
    method: "POST",
    endpoint: `/seats/${libraryId}/${seatNumber}/book`,
    data: {
      ...payload,
      operationId,
    },
  });

  console.log("Queued offline seat booking:", operationId);
};


export default {
  isOnline,
  setupOnlineListener,
  syncPendingOperations,
  syncDataFromServer,
  queueOperation,
  apiCallWithOfflineSupport,
  getDataWithOfflineFallback,
};



