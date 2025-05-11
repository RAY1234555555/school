"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import Head from "next/head"
import Link from "next/link"
import { parse } from "cookie"

// --- fetchGoogleUser Helper (Same as in student-card.js) ---
async function fetchGoogleUser(email) {
  console.log(`[fetchGoogleUser - Portal] Attempting to get refresh token for: ${email}`)
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN, // Critical: Must be valid!
      grant_type: "refresh_token",
    }),
  })

  if (!tokenRes.ok) {
    const errorBody = await tokenRes.text()
    console.error(`[fetchGoogleUser - Portal] Failed to refresh Google token: ${tokenRes.status}`, errorBody)
    return null // Indicate failure
  }

  const { access_token } = await tokenRes.json()
  console.log(`[fetchGoogleUser - Portal] Got new access token. Fetching user data...`)

  const userRes = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?projection=full`,
    { headers: { Authorization: `Bearer ${access_token}` } },
  )

  if (!userRes.ok) {
    const errorBody = await userRes.text()
    console.error(`[fetchGoogleUser - Portal] Failed to fetch Google user data: ${userRes.status}`, errorBody)
    return null // Indicate failure
  }
  console.log(`[fetchGoogleUser - Portal] Successfully fetched user data.`)
  return await userRes.json()
}

// --- getServerSideProps (Logic mirrored from student-card.js) ---
export async function getServerSideProps({ req }) {
  console.log("[getServerSideProps - Portal] Starting...")
  const cookies = parse(req.headers.cookie || "")

  const oauthUsername = cookies.oauthUsername || null
  // *** Prioritize reading student ID from cookie ***
  const studentIdFromCookie = cookies.oauthStudentId || cookies.oauthUserId || null
  const oauthFullNameFromCookie = cookies.oauthFullName || null
  const trustLevel = Number.parseInt(cookies.oauthTrustLevel || "0", 10)

  console.log("[getServerSideProps - Portal] Cookies parsed:", cookies)

  // Authentication check
  if (!oauthUsername || trustLevel < 3) {
    // Keep appropriate trust level check
    console.log("[getServerSideProps - Portal] Redirecting: No username or insufficient trust.")
    return { redirect: { destination: "/", permanent: false } }
  }

  // Construct email
  const rawDom = process.env.EMAIL_DOMAIN
  const domain = rawDom && rawDom.startsWith("@") ? rawDom : "@" + (rawDom || "kzxy.edu.kg")
  const studentEmail = oauthUsername.includes("@") ? oauthUsername : `${oauthUsername}${domain}`

  console.log("[getServerSideProps - Portal] Attempting fetchGoogleUser for:", studentEmail)

  // Fetch data from Google
  let googleUser
  let fetchError = null
  try {
    googleUser = await fetchGoogleUser(studentEmail)
  } catch (error) {
    console.error("[getServerSideProps - Portal] Error during fetchGoogleUser call:", error)
    fetchError = "Failed to communicate with Google services."
    googleUser = null
  }

  // --- Handle Failure to Fetch Google Data (Use Cookie Fallback) ---
  if (!googleUser) {
    console.log("[getServerSideProps - Portal] fetchGoogleUser failed or returned null.")
    if (studentIdFromCookie && oauthFullNameFromCookie) {
      console.warn("[getServerSideProps - Portal] Falling back to cookie data due to fetch failure.")
      return {
        props: {
          initialFullName: oauthFullNameFromCookie,
          initialEmail: studentEmail,
          initialStudentId: studentIdFromCookie, // Use ID from cookie
          fetchError: "Could not refresh data from Google; showing last known info.",
        },
      }
    } else {
      // If no fallback possible
      console.log(
        "[getServerSideProps - Portal] Redirecting: fetchGoogleUser failed and no sufficient cookie fallback.",
      )
      return { redirect: { destination: "/?error=profile_fetch_failed_no_fallback", permanent: false } }
    }
  }

  // --- Extract Data (Prioritize Google for Name/Email, Cookie for ID) ---
  console.log("[getServerSideProps - Portal] Google user data fetched successfully.")
  const fullName = googleUser.name
    ? `${googleUser.name.familyName || ""}${googleUser.name.givenName || ""}`.trim()
    : oauthFullNameFromCookie || "Name Missing"
  const emailFromGoogle = googleUser.primaryEmail || studentEmail

  // *** Student ID: Use cookie ID first, then Google ID as last resort ***
  const finalStudentId = studentIdFromCookie || googleUser.id || null

  if (!finalStudentId) {
    console.error("[getServerSideProps - Portal] Error: Student ID is missing after Google fetch and cookie check.")
    return { props: { error: "Student ID is missing, cannot display portal." } }
  }

  console.log("[getServerSideProps - Portal] Data prepared:", { fullName, emailFromGoogle, finalStudentId })

  // Pass data as props
  return {
    props: {
      initialFullName: fullName,
      initialEmail: emailFromGoogle,
      initialStudentId: finalStudentId,
      fetchError: null, // Successful fetch
    },
  }
}

// --- Modified StudentPortal Component ---
export default function StudentPortal({ initialFullName, initialEmail, initialStudentId, error, fetchError }) {
  const router = useRouter()
  // State for client-side calculations
  const [currentSemester, setCurrentSemester] = useState("")
  const [currentYear, setCurrentYear] = useState("")
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    let semesterText = ""
    // Adjust semester terms if needed (using English based on screenshot)
    if (month >= 9 || month <= 2) semesterText = `${year} Fall/Winter`
    else if (month >= 3 && month <= 8) semesterText = `${year} Spring/Summer`
    else semesterText = `${year}`
    setCurrentSemester(semesterText)
    setCurrentYear(year)
  }, [])

  // Delete handler
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (!response.ok) {
        throw new Error("Deletion failed")
      }
      alert("Account deleted successfully.")
      router.push("/api/logout")
    } catch (err) {
      console.error("Error deleting account:", err)
      alert("An error occurred while deleting the account.")
      setIsDeleting(false)
    }
  }

  const handleLogout = () => {
    setIsLoggingOut(true)
    fetch("/api/logout", {
      method: "POST",
    }).then(() => {
      router.push("/")
    })
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-content">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h2>Error Loading Portal</h2>
          <p>{error}</p>
          <div className="error-actions">
            <a href="/student-portal" className="error-button retry">
              Retry
            </a>
            <a href="/" className="error-button home">
              Go to Login
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Student Portal - Confucius Institute</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="portal-wrapper">
        <header className="portal-header">
          <div className="header-container">
            <div className="header-left">
              <img
                src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png"
                alt="Confucius Institute Logo"
                className="header-logo"
              />
              <div className="header-titles">
                <h1>孔子学院学生门户</h1>
                <h2>Confucius Institute Student Portal</h2>
              </div>
            </div>
            <div className="header-right">
              <button onClick={handleLogout} disabled={isLoggingOut} className="logout-button">
                {isLoggingOut ? (
                  <span className="button-spinner"></span>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    <span>Logout</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="portal-main">
          <div className="main-container">
            {fetchError && (
              <div className="alert-banner">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{fetchError}</span>
              </div>
            )}

            <section className="profile-section">
              <div className="section-header">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <h3>Student Information</h3>
              </div>

              <div className="profile-cards">
                <div className="profile-card">
                  <div className="profile-label">NAME</div>
                  <div className="profile-value">{initialFullName || "Loading..."}</div>
                </div>

                <div className="profile-card">
                  <div className="profile-label">SEMESTER</div>
                  <div className="profile-value">{currentSemester || "Calculating..."}</div>
                </div>

                <div className="profile-card">
                  <div className="profile-label">PROGRAM</div>
                  <div className="profile-value">汉语学习项目</div>
                </div>

                <div className="profile-card">
                  <div className="profile-label">STUDENT EMAIL</div>
                  <div className="profile-value">{initialEmail || "Loading..."}</div>
                </div>

                <div className="profile-card">
                  <div className="profile-label">STUDENT ID</div>
                  <div className="profile-value id">{initialStudentId || "Loading..."}</div>
                </div>
              </div>
            </section>

            <section className="services-section">
              <div className="section-header">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                <h3>Quick Access</h3>
              </div>

              <div className="services-grid">
                <a
                  href={`https://mail.google.com/a/${
                    initialEmail?.split("@")[1] || "kzxy.edu.kg"
                  }?Email=${encodeURIComponent(initialEmail || "")}`}
                  className="service-card"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="service-icon email">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                  </div>
                  <h4>Student Email</h4>
                  <p>Access your student email account</p>
                </a>

                <Link href="/student-card" legacyBehavior>
                  <a className="service-card">
                    <div className="service-icon card">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                        <line x1="2" y1="10" x2="22" y2="10"></line>
                      </svg>
                    </div>
                    <h4>Student Card</h4>
                    <p>View your digital student ID card</p>
                  </a>
                </Link>

                <a href="https://account.adobe.com/" className="service-card" target="_blank" rel="noopener noreferrer">
                  <div className="service-icon adobe">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                      <path d="M12 8v8"></path>
                      <path d="M8 12h8"></path>
                    </svg>
                  </div>
                  <h4>Adobe Express</h4>
                  <p>Create graphics, videos, and web pages</p>
                </a>

                <Link href="/transcript" legacyBehavior>
                  <a className="service-card">
                    <div className="service-icon transcript">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </div>
                    <h4>Transcript</h4>
                    <p>View your academic transcript</p>
                  </a>
                </Link>

                <a
                  href="https://www.canva.com/login"
                  className="service-card"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="service-icon canva">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                  </div>
                  <h4>Canva</h4>
                  <p>Design presentations and graphics</p>
                </a>

                <Link href="/reset-password" legacyBehavior>
                  <a className="service-card">
                    <div className="service-icon password">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                    <h4>Reset Password</h4>
                    <p>Change your account password</p>
                  </a>
                </Link>

                <Link href="/aliases" legacyBehavior>
                  <a className="service-card">
                    <div className="service-icon aliases">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                    </div>
                    <h4>Add Email Alias</h4>
                    <p>Create additional email addresses</p>
                  </a>
                </Link>
              </div>
            </section>
          </div>
        </main>

        <footer className="portal-footer">
          <div className="footer-container">
            <div className="footer-actions">
              <button onClick={() => setIsDeleteModalOpen(true)} className="delete-button">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                <span>Delete Account</span>
              </button>
            </div>
            <div className="footer-text">
              孔子学院学生服务 | Confucius Institute Student Services | Powered by{" "}
              <a href="https://kzxy.edu.kg" target="_blank" rel="noopener noreferrer">
                kzxy.edu.kg
              </a>{" "}
              | © {currentYear || new Date().getFullYear()}
            </div>
          </div>
        </footer>

        {isDeleteModalOpen && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <h3>Delete Account</h3>
                <button onClick={() => setIsDeleteModalOpen(false)} className="modal-close">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="modal-content">
                <div className="modal-icon warning">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </div>
                <p className="modal-message">
                  Are you sure you want to delete your account? This action is permanent and cannot be undone.
                </p>
                <p className="modal-details">
                  Your account, email, and all associated data will be permanently removed from our systems.
                </p>
              </div>
              <div className="modal-actions">
                <button onClick={() => setIsDeleteModalOpen(false)} className="modal-button cancel">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={isDeleting} className="modal-button delete">
                  {isDeleting ? <span className="button-spinner"></span> : "Delete Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        :global(body) {
          margin: 0;
          padding: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          background-color: #f5f7fa;
          color: #333;
          min-height: 100vh;
        }

        /* Error Page Styling */
        .error-container {
          display: flex;
          min-height: 100vh;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: linear-gradient(135deg, #f0f4f8, #ecf0f3);
        }

        .error-content {
          background: white;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          text-align: center;
          max-width: 400px;
          width: 100%;
        }

        .error-content svg {
          color: #e53e3e;
          margin-bottom: 20px;
        }

        .error-content h2 {
          margin: 0 0 15px 0;
          font-size: 24px;
          color: #1a202c;
        }

        .error-content p {
          margin: 0 0 25px 0;
          color: #4a5568;
        }

        .error-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .error-button {
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .error-button.retry {
          background: #3b82f6;
          color: white;
        }

        .error-button.home {
          background: #e2e8f0;
          color: #4a5568;
        }

        .error-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        /* Portal Styling */
        .portal-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Header Styling */
        .portal-header {
          background: linear-gradient(135deg, #1d4ed8, #3b82f6);
          color: white;
          padding: 16px 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-left {
          display: flex;
          align-items: center;
        }

        .header-logo {
          height: 50px;
          margin-right: 16px;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
        }

        .header-titles h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .header-titles h2 {
          margin: 0;
          font-size: 14px;
          font-weight: 400;
          opacity: 0.9;
        }

        .header-right {
          display: flex;
          align-items: center;
        }

        .logout-button {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .logout-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .logout-button:active {
          transform: translateY(1px);
        }

        .logout-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .button-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Main Content Styling */
        .portal-main {
          flex: 1;
          padding: 30px 0;
        }

        .main-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .alert-banner {
          background: #fff3cd;
          color: #856404;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #ffeeba;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Section Styling */
        .section-header {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
          gap: 12px;
        }

        .section-header svg {
          color: #3b82f6;
        }

        .section-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
        }

        /* Profile Section */
        .profile-section {
          background: white;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 30px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .profile-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
        }

        .profile-card {
          background: #f9fafb;
          border-radius: 12px;
          padding: 16px;
          border: 1px solid #e5e7eb;
          transition: all 0.2s ease;
        }

        .profile-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          border-color: #d1d5db;
        }

        .profile-label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }

        .profile-value {
          font-size: 16px;
          font-weight: 500;
          color: #1f2937;
          word-break: break-word;
        }

        .profile-value.id {
          font-family: monospace;
          color: #2563eb;
          font-weight: 600;
        }

        /* Services Section */
        .services-section {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
        }

        .service-card {
          background: #f9fafb;
          border-radius: 12px;
          padding: 24px;
          text-decoration: none;
          color: inherit;
          border: 1px solid #e5e7eb;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .service-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          border-color: #d1d5db;
        }

        .service-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          color: white;
        }

        .service-icon.email {
          background: linear-gradient(135deg, #d946ef, #8b5cf6);
        }

        .service-icon.card {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
        }

        .service-icon.adobe {
          background: linear-gradient(135deg, #ef4444, #dc2626);
        }

        .service-icon.transcript {
          background: linear-gradient(135deg, #10b981, #059669);
        }

        .service-icon.canva {
          background: linear-gradient(135deg, #f59e0b, #d97706);
        }

        .service-icon.password {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
        }

        .service-icon.aliases {
          background: linear-gradient(135deg, #ec4899, #db2777);
        }

        .service-card h4 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .service-card p {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        /* Footer Styling */
        .portal-footer {
          background: #1f2937;
          color: white;
          padding: 20px 0;
          margin-top: auto;
        }

        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .footer-actions {
          display: flex;
          gap: 12px;
        }

        .delete-button {
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .delete-button:hover {
          background: #dc2626;
        }

        .delete-button:active {
          transform: translateY(1px);
        }

        .footer-text {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          text-align: center;
        }

        .footer-text a {
          color: rgba(255, 255, 255, 0.9);
          text-decoration: none;
        }

        .footer-text a:hover {
          text-decoration: underline;
        }

        /* Modal Styling */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 20px;
          backdrop-filter: blur(4px);
          animation: fadeIn 0.2s ease;
        }

        .modal-container {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 450px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
        }

        .modal-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .modal-close:hover {
          background: #f3f4f6;
          color: #1f2937;
        }

        .modal-content {
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .modal-icon {
          margin-bottom: 20px;
        }

        .modal-icon.warning {
          color: #ef4444;
        }

        .modal-message {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 500;
          color: #1f2937;
        }

        .modal-details {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        .modal-actions {
          padding: 16px 24px 24px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .modal-button {
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .modal-button.cancel {
          background: #f3f4f6;
          color: #1f2937;
          border: 1px solid #e5e7eb;
        }

        .modal-button.cancel:hover {
          background: #e5e7eb;
        }

        .modal-button.delete {
          background: #ef4444;
          color: white;
          border: none;
        }

        .modal-button.delete:hover {
          background: #dc2626;
        }

        .modal-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* Responsive Styles */
        @media (max-width: 992px) {
          .services-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .header-container {
            flex-direction: column;
            gap: 12px;
            text-align: center;
          }

          .header-left {
            flex-direction: column;
          }

          .header-logo {
            margin-right: 0;
            margin-bottom: 8px;
          }

          .profile-cards {
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          }

          .services-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 16px;
          }

          .service-card {
            padding: 16px;
          }

          .service-icon {
            width: 48px;
            height: 48px;
          }

          .service-card h4 {
            font-size: 15px;
          }

          .service-card p {
            font-size: 13px;
          }
        }

        @media (max-width: 480px) {
          .portal-header {
            padding: 12px 0;
          }

          .header-logo {
            height: 40px;
          }

          .header-titles h1 {
            font-size: 16px;
          }

          .header-titles h2 {
            font-size: 12px;
          }

          .portal-main {
            padding: 20px 0;
          }

          .main-container {
            padding: 0 15px;
          }

          .section-header h3 {
            font-size: 18px;
          }

          .profile-section, .services-section {
            padding: 16px;
            border-radius: 12px;
          }

          .profile-cards {
            grid-template-columns: 1fr;
          }

          .services-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }

          .service-card {
            padding: 12px;
          }

          .service-icon {
            width: 40px;
            height: 40px;
            margin-bottom: 12px;
          }

          .service-card h4 {
            font-size: 14px;
            margin-bottom: 4px;
          }

          .service-card p {
            font-size: 12px;
          }

          .modal-container {
            max-width: 100%;
          }
        }
      `}</style>
    </>
  )
}
