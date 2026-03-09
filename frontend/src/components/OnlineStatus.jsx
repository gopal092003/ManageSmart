import { useState, useEffect } from "react";
import { setupOnlineListener, syncPendingOperations } from "../services/offlineSync";

const OnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnlineStatus = async (online) => {
      setIsOnline(online);
      if (online) {
        // When coming back online, sync pending operations
        setSyncing(true);
        try {
          await syncPendingOperations();
          console.log("Sync completed");
        } catch (error) {
          console.error("Error during sync:", error);
        } finally {
          setSyncing(false);
        }
      }
    };

    setupOnlineListener(handleOnlineStatus);
  }, []);

  if (isOnline && !syncing) {
    return null; // Don't show anything when online
  }

  return (
    <div
      className={`alert ${
        isOnline && syncing ? "alert-info" : !isOnline ? "alert-warning" : ""
      } mb-0 position-fixed top-0 start-0 end-0 z-3 online-status`}
      style={{ 
        borderRadius: 0, 
        marginTop: isOnline && !syncing ? "-100px" : "0",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
      }}
    >
      <div className="container d-flex justify-content-between align-items-center py-2">
        <span>
          {isOnline && syncing && (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
              <strong>🔄 Syncing data...</strong> Please wait while we sync your changes.
            </>
          )}
          {!isOnline && (
            <>
              <strong>⚠️ Offline Mode:</strong> You're working offline. Changes will be synced automatically when connection is restored.
            </>
          )}
        </span>
      </div>
    </div>
  );
};

export default OnlineStatus;

