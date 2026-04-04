import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheck, FaTimes, FaSpinner } from "react-icons/fa";
import { useCustomerModern } from "../context/CustomerModernContext";
import { digiLockerService } from "../services/digiLockerService";
import { userService } from "../services/userService";
import { customerStorage } from "../services/storageService";

const KycCallbackScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuthSession, userData } = useCustomerModern();
  const [status, setStatus] = useState("processing"); // processing, success, error
  const [message, setMessage] = useState("Processing verification...");
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double processing
    if (processedRef.current) return;
    processedRef.current = true;

    // Log full URL and params for debugging
    console.log("KYC Callback - Full URL:", window.location.href);
    console.log("KYC Callback - Session token exists:", !!customerStorage.getSessionToken());

    processCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processCallback = async () => {
    try {
      // Get callback parameters from URL
      const gateway = searchParams.get("gateway");
      const type = searchParams.get("type");
      const clientId = searchParams.get("client_id");
      const callbackStatus = searchParams.get("status");

      console.log("KYC Callback params:", { gateway, type, clientId, callbackStatus });
      console.log("KYC Callback - userData available:", !!userData);

      // Get pending state from sessionStorage
      const pendingState = JSON.parse(sessionStorage.getItem("pendingDigiLocker") || "{}");
      const returnTo = pendingState.returnTo || "/customer/app/profile";

      // If status is not success from DigiLocker
      if (callbackStatus !== "success") {
        setStatus("error");
        setMessage("DigiLocker verification was cancelled or failed. Please try again.");
        setTimeout(() => navigate(returnTo, { replace: true }), 3000);
        return;
      }

      // Validate required params
      if (!gateway || !type || !clientId) {
        setStatus("error");
        setMessage("Invalid callback parameters. Please try again.");
        setTimeout(() => navigate(returnTo, { replace: true }), 3000);
        return;
      }

      setMessage("Verifying with DigiLocker...");

      console.log("KYC Callback - Calling processDigiLockerCallback API...");

      // Process the callback via API
      const result = await digiLockerService.processDigiLockerCallback({
        gateway,
        type,
        client_id: clientId,
        status: callbackStatus,
      });

      console.log("KYC Callback - API result:", JSON.stringify(result, null, 2));

      if (result.success) {
        setMessage("Updating KYC status...");

        // Update user data with verified status
        const updatedUserData = {
          ...userData,
          verified_status: 1,
          kyc_verified: true,
          kyc_type: "digilocker",
          ...(result.data?.name && { name: result.data.name }),
          ...(result.data?.city && { city: result.data.city }),
          ...(result.data?.state && { state: result.data.state }),
        };

        // Update local state
        setAuthSession({ userData: updatedUserData });
        sessionStorage.removeItem("pendingDigiLocker");

        // Also refresh user profile from server to get latest data
        try {
          const profileResult = await userService.getUserProfile();
          if (profileResult.success && profileResult.data) {
            const serverData = profileResult.data;
            setAuthSession({
              userData: {
                ...updatedUserData,
                ...serverData,
                verified_status: serverData.verified_status ?? 1,
                kyc_verified: true,
              },
            });
          }
        } catch (e) {
          console.log("Profile refresh failed, using local data");
        }

        setStatus("success");
        setMessage("KYC verification completed successfully!");

        setTimeout(() => navigate(returnTo, { replace: true }), 2000);
      } else {
        setStatus("error");
        setMessage(result.message || "Verification failed. Please try again.");
        setTimeout(() => navigate(returnTo, { replace: true }), 3000);
      }
    } catch (error) {
      console.error("KYC Callback error:", error);
      console.error("KYC Callback error stack:", error?.stack);
      setStatus("error");
      setMessage("An error occurred while processing verification.");
      setTimeout(() => navigate("/customer/app/profile", { replace: true }), 3000);
    }
  };

  return (
    <div className="cm-page-animate kyc-callback-page">
      <div className="kyc-callback-card">
        {status === "processing" && (
          <>
            <div className="kyc-callback-icon kyc-callback-icon--loading">
              <FaSpinner className="kyc-spin" />
            </div>
            <h2>Processing</h2>
            <p>{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="kyc-callback-icon kyc-callback-icon--success">
              <FaCheck />
            </div>
            <h2>Verification Successful</h2>
            <p>{message}</p>
            <p className="kyc-callback-redirect">Redirecting...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="kyc-callback-icon kyc-callback-icon--error">
              <FaTimes />
            </div>
            <h2>Verification Failed</h2>
            <p>{message}</p>
            <p className="kyc-callback-redirect">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default KycCallbackScreen;
