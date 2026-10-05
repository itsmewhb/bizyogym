import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  where,
  getDocs,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { Html5Qrcode } from "html5-qrcode";
import { db } from "../firebase";
import "./EntryLog.css";

function EntryLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [scanResult, setScanResult] = useState(null);
  const [scanMessage, setScanMessage] = useState("");
  const [scanType, setScanType] = useState("");

  const scannerRef = useRef(null);
  const scanLock = useRef(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  /*
   * Format Firestore timestamp
   */
  const formatDate = (timestamp) => {
    if (!timestamp) return "-";

    const date = timestamp.toDate();

    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "-";

    const date = timestamp.toDate();

    return date.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  /*
   * Load Entry Logs
   */
  useEffect(() => {
    const entryQuery = query(
      collection(db, "entryLogs"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      entryQuery,
      (snapshot) => {
        const entriesData = snapshot.docs.map((entryDoc) => ({
          id: entryDoc.id,
          ...entryDoc.data(),
        }));

        setEntries(entriesData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading entry logs:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  /*
   * Process QR Scan
   */
  const handleScan = async (decodedText) => {
    if (scanLock.current) {
      return;
    }

    scanLock.current = true;

    try {
      console.log("Scanned QR:", decodedText);

      /*
       * Find member
       */
      const memberRef = doc(db, "members", decodedText);

      const memberSnapshot = await getDoc(memberRef);

      if (!memberSnapshot.exists()) {
        setScanResult(null);
        setScanMessage("Member not found.");
        setScanType("error");

        setTimeout(() => {
          scanLock.current = false;
        }, 3000);

        return;
      }

      const member = {
        id: memberSnapshot.id,
        ...memberSnapshot.data(),
      };

      /*
       * Check member restriction
       */
      let restrictionActive = member.isRestricted === true;

      if (restrictionActive && member.restrictionUntil) {
        const restrictionEnd = new Date(`${member.restrictionUntil}T23:59:59`);

        const currentDate = new Date();

        /*
         * Restriction has expired
         */
        if (currentDate > restrictionEnd) {
          restrictionActive = false;

          try {
            await updateDoc(doc(db, "members", member.id), {
              isRestricted: false,
              restrictionReason: "",
              restrictionDate: null,
              restrictionUntil: null,
            });

            console.log(
              `Restriction automatically removed from ${member.name}`,
            );
          } catch (error) {
            console.error("Error removing expired restriction:", error);
          }
        }
      }

      /*
       * Member is restricted
       */
      if (restrictionActive) {
        setScanResult(member);

        const untilText = member.restrictionUntil
          ? new Date(`${member.restrictionUntil}T00:00:00`).toLocaleDateString(
            "en-PH",
            {
              year: "numeric",
              month: "short",
              day: "numeric",
            },
          )
          : null;

        setScanMessage(
          `Entry denied. ${member.name} is restricted${member.restrictionReason ? `: ${member.restrictionReason}` : "."
          }${untilText ? ` Restriction until ${untilText}.` : " No end date."}`,
        );

        setScanType("error");

        setTimeout(() => {
          scanLock.current = false;
        }, 3000);

        return;
      }

      /*
  * Check member status
  */
      if (member.status !== "Active") {
        setScanResult(member);

        setScanMessage(
          `Entry denied. ${member.name} is not an active member.`,
        );

        setScanType("error");

        setTimeout(() => {
          scanLock.current = false;
        }, 3000);

        return;
      }

      /*
       * Check membership expiration
       */
      if (member.membershipExpirationDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expirationDate = new Date(
          `${member.membershipExpirationDate}T00:00:00`,
        );

        if (today > expirationDate) {
          setScanResult(member);

          setScanMessage(
            `Entry denied. ${member.name}'s membership expired on ${expirationDate.toLocaleDateString(
              "en-PH",
              {
                year: "numeric",
                month: "short",
                day: "numeric",
              },
            )}.`,
          );

          setScanType("error");

          setTimeout(() => {
            scanLock.current = false;
          }, 3000);

          return;
        }
      }

      /*
       * Check membership payment
       */
      const paymentsQuery = query(
        collection(db, "payments"),
        where("memberId", "==", member.id),
      );

      const paymentsSnapshot = await getDocs(paymentsQuery);

      const totalPaid = paymentsSnapshot.docs.reduce(
        (total, paymentDoc) => {
          const payment = paymentDoc.data();

          return total + Number(payment.amount || 0);
        },
        0,
      );

      const membershipPrice = Number(member.membershipPrice || 0);

      /*
       * Membership must be fully paid
       */
      if (membershipPrice <= 0 || totalPaid < membershipPrice) {
        const remainingBalance = Math.max(
          membershipPrice - totalPaid,
          0,
        );

        setScanResult(member);

        setScanMessage(
          `Entry denied. ${member.name} has not fully paid the membership.${remainingBalance > 0
            ? ` Remaining balance: ₱${remainingBalance.toLocaleString(
              "en-PH",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}.`
            : " Please settle the membership payment first."
          }`,
        );

        setScanType("error");

        setTimeout(() => {
          scanLock.current = false;
        }, 3000);

        return;
      }

      /*
       * Check if member is already inside
       */

      /*
       * Check if member is already inside
       */
      const insideQuery = query(
        collection(db, "entryLogs"),
        where("memberId", "==", member.id),
        where("status", "==", "Inside"),
      );

      const insideSnapshot = await getDocs(insideQuery);

      /*
       * Already inside → CHECK OUT
       */
      if (!insideSnapshot.empty) {
        const entryDocument = insideSnapshot.docs[0];

        await updateDoc(doc(db, "entryLogs", entryDocument.id), {
          checkOutAt: Timestamp.now(),
          status: "Completed",
        });

        setScanResult(member);
        setScanMessage(`${member.name} checked out successfully.`);
        setScanType("checkout");

        setTimeout(() => {
          scanLock.current = false;
        }, 3000);

        return;
      }

      /*
       * Not inside → CHECK IN
       */
      await addDoc(collection(db, "entryLogs"), {
        memberId: member.id,
        memberName: member.name,
        checkInAt: Timestamp.now(),
        checkOutAt: null,
        status: "Inside",
        createdAt: serverTimestamp(),
      });

      setScanResult(member);
      setScanMessage(`${member.name} checked in successfully.`);
      setScanType("checkin");

      setTimeout(() => {
        scanLock.current = false;
      }, 3000);
    } catch (error) {
      console.error("QR scan error:", error);

      setScanResult(null);
      setScanMessage("Something went wrong while processing the scan.");
      setScanType("error");

      setTimeout(() => {
        scanLock.current = false;
      }, 3000);
    }
  };

  /*
   * Start QR Scanner
   */
  useEffect(() => {
    let isMounted = true;
    let scanner = null;
    let scannerStarted = false;

    const startScanner = async () => {
      try {
        // Make sure the page is still mounted
        if (!isMounted) return;

        // Prevent duplicate scanner element initialization
        const qrReader = document.getElementById("qr-reader");

        if (!qrReader) {
          console.error("QR reader element not found.");
          return;
        }

        // Clear anything left inside the scanner container
        qrReader.innerHTML = "";

        scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        console.log("QR scanner created.");

        const cameras = await Html5Qrcode.getCameras();

        if (!isMounted) {
          return;
        }

        if (!cameras || cameras.length === 0) {
          setScanMessage("No camera found.");
          setScanType("error");
          return;
        }

        console.log("Available cameras:", cameras);

        // Try to find the rear/back camera
        const backCamera =
          cameras.find((camera) => {
            const label = camera.label?.toLowerCase() || "";

            return (
              label.includes("back") ||
              label.includes("rear") ||
              label.includes("environment")
            );
          }) || cameras[0];

        console.log("Selected camera:", backCamera);

        await scanner.start(
          backCamera.id,
          {
            fps: 10,

            qrbox: {
              width: 250,
              height: 250,
            },

            aspectRatio: 1.7777778,

            videoConstraints: {
              facingMode: "environment",
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
            },
          },

          (decodedText) => {
            if (!isMounted) return;

            console.log("QR CODE DETECTED:", decodedText);

            handleScan(decodedText);
          },

          () => {
            // Ignore normal QR scanning errors
          },
        );

        scannerStarted = true;

        console.log("QR scanner started successfully.");
      } catch (error) {
        console.error("Scanner start error:", error);

        if (isMounted) {
          setScanMessage(
            "Unable to start the camera. Please check your camera permission.",
          );
          setScanType("error");
        }
      }
    };

    startScanner();

    /*
     * Cleanup when leaving Entry Log
     */
    return () => {
      isMounted = false;

      const currentScanner = scanner;

      scanner = null;
      scannerRef.current = null;

      if (!currentScanner) {
        return;
      }

      const cleanupScanner = async () => {
        try {
          if (scannerStarted) {
            await currentScanner.stop();
            console.log("QR scanner stopped.");
          }
        } catch (error) {
          console.warn("Scanner stop warning:", error);
        }

        try {
          currentScanner.clear();
          console.log("QR scanner cleared.");
        } catch (error) {
          console.warn("Scanner clear warning:", error);
        }

        // Extra cleanup in case anything remains
        const qrReader = document.getElementById("qr-reader");

        if (qrReader) {
          qrReader.innerHTML = "";
        }
      };

      cleanupScanner();
    };
  }, []);

  return (
    <div className="entry-log-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Entry Log</h1>

          <p>
            Scan the member's QR code to automatically check them in or out.
          </p>
        </div>

        <div className="current-date-time">
          <div className="current-date">
            {currentDateTime.toLocaleDateString("en-PH", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>

          <div className="current-time">
            {currentDateTime.toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        </div>
      </div>

      {/* Scanner */}
      <div className="entry-scanner-section">
        <div className="scanner-card">
          <h2>Scan Member QR Code</h2>

          <p className="scanner-description">
            Place the member QR code inside the scanner.
          </p>

          <div id="qr-reader"></div>

          {/* Scan Result */}
          {scanMessage && (
            <div className={`scan-result ${scanType}`}>
              <div className="scan-icon">
                {scanType === "checkin" && "✓"}
                {scanType === "checkout" && "✓"}
                {scanType === "error" && "!"}
              </div>

              <div>
                <strong>{scanMessage}</strong>

                {scanResult && (
                  <p>
                    {scanResult.name}

                    {scanResult.membership && ` • ${scanResult.membership}`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Entry History */}
      <div className="entry-log-card">
        <div className="table-header">
          <h2>Recent Entries</h2>
        </div>

        {loading ? (
          <p className="loading-text">Loading entries...</p>
        ) : entries.length === 0 ? (
          <p className="empty-text">No entries recorded yet.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.memberName}</td>

                    <td>{formatDate(entry.checkInAt)}</td>

                    <td>{formatTime(entry.checkInAt)}</td>

                    <td>{formatTime(entry.checkOutAt)}</td>

                    <td>
                      <span
                        className={`entry-status ${entry.status
                          ?.toLowerCase()
                          .replace(" ", "-")}`}
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default EntryLog;
