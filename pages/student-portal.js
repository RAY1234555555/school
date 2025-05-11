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
    ? `${googleUser.name.givenName || ""} ${googleUser.name.familyName || ""}`.trim()
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

// --- Completely Redesigned StudentPortal Component ---
export default function StudentPortal({ initialFullName, initialEmail, initialStudentId, error, fetchError }) {
  const router = useRouter()
  const [currentSemester, setCurrentSemester] = useState("")
  const [currentYear, setCurrentYear] = useState("")
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    let semesterText = ""
    if (month >= 9 || month <= 2) semesterText = `${year} Fall/Winter`
    else if (month >= 3 && month <= 8) semesterText = `${year} Spring/Summer`
    else semesterText = `${year}`
    setCurrentSemester(semesterText)
    setCurrentYear(year)
  }, [])

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
      <div className="error-page">
        <div className="error-container">
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
            className="error-icon"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h1>Unable to Load Portal</h1>
          <p>{error}</p>
          <div className="error-actions">
            <a href="/student-portal" className="btn btn-primary">
              Try Again
            </a>
            <a href="/" className="btn btn-secondary">
              Return to Login
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Student Portal | Confucius Institute</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Text:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="app-container">
        {/* Sidebar */}
        <aside className={`sidebar ${isMobileMenuOpen ? "sidebar-open" : ""}`}>
          <div className="sidebar-header">
            <img
              src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png"
              alt="Confucius Institute"
              className="sidebar-logo"
            />
            <button className="close-menu-btn" onClick={() => setIsMobileMenuOpen(false)}>
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

          <div className="sidebar-user">
            <div className="user-avatar">{initialFullName ? initialFullName.charAt(0).toUpperCase() : "S"}</div>
            <div className="user-info">
              <h3 className="user-name">{initialFullName || "Student"}</h3>
              <p className="user-email">{initialEmail || "Loading..."}</p>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section">
              <h4 className="nav-title">Services</h4>
              <ul className="nav-list">
                <li className="nav-item active">
                  <a href="#dashboard" className="nav-link">
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
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                    Dashboard
                  </a>
                </li>
                <li className="nav-item">
                  <a
                    href={`https://mail.google.com/a/${
                      initialEmail?.split("@")[1] || "kzxy.edu.kg"
                    }?Email=${encodeURIComponent(initialEmail || "")}`}
                    className="nav-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
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
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    Email
                  </a>
                </li>
                <li className="nav-item">
                  <Link href="/student-card" legacyBehavior>
                    <a className="nav-link">
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
                        <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                        <line x1="2" y1="10" x2="22" y2="10"></line>
                      </svg>
                      Student Card
                    </a>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link href="/transcript" legacyBehavior>
                    <a className="nav-link">
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
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      Transcript
                    </a>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link href="/aliases" legacyBehavior>
                    <a className="nav-link">
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
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      Email Aliases
                    </a>
                  </Link>
                </li>
              </ul>
            </div>

            <div className="nav-section">
              <h4 className="nav-title">Tools</h4>
              <ul className="nav-list">
                <li className="nav-item">
                  <a href="https://account.adobe.com/" className="nav-link" target="_blank" rel="noopener noreferrer">
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
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                    Adobe Express
                  </a>
                </li>
                <li className="nav-item">
                  <a href="https://www.canva.com/login" className="nav-link" target="_blank" rel="noopener noreferrer">
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
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    Canva
                  </a>
                </li>
              </ul>
            </div>

            <div className="nav-section">
              <h4 className="nav-title">Account</h4>
              <ul className="nav-list">
                <li className="nav-item">
                  <Link href="/reset-password" legacyBehavior>
                    <a className="nav-link">
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
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      Reset Password
                    </a>
                  </Link>
                </li>
                <li className="nav-item">
                  <button onClick={handleLogout} disabled={isLoggingOut} className="nav-link logout">
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
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </button>
                </li>
                <li className="nav-item">
                  <button onClick={() => setIsDeleteModalOpen(true)} className="nav-link delete">
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
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Delete Account
                  </button>
                </li>
              </ul>
            </div>
          </nav>

          <div className="sidebar-footer">
            <p>
              © {currentYear} Confucius Institute
              <br />
              <a href="https://kzxy.edu.kg" target="_blank" rel="noopener noreferrer">
                kzxy.edu.kg
              </a>
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {/* Top Bar */}
          <header className="top-bar">
            <button className="menu-toggle" onClick={() => setIsMobileMenuOpen(true)}>
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
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h1 className="page-title">Student Dashboard</h1>
            <div className="top-bar-actions">
              <button onClick={handleLogout} disabled={isLoggingOut} className="logout-btn">
                {isLoggingOut ? (
                  <span className="loading-spinner"></span>
                ) : (
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
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                )}
              </button>
            </div>
          </header>

          {/* Alert Banner */}
          {fetchError && (
            <div className="alert">
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

          {/* Content Area */}
          <div className="content">
            {/* Welcome Section */}
            <section className="welcome-section">
              <div className="welcome-text">
                <h2>Welcome, {initialFullName || "Student"}!</h2>
                <p>Here's what you need to know for {currentSemester || "this semester"}.</p>
              </div>
            </section>

            {/* Student Info Card */}
            <section className="info-section">
              <div className="section-header">
                <h2 className="section-title">Student Information</h2>
              </div>
              <div className="info-card">
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Name</span>
                    <span className="info-value">{initialFullName || "Loading..."}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Student ID</span>
                    <span className="info-value highlight">{initialStudentId || "Loading..."}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Email</span>
                    <span className="info-value">{initialEmail || "Loading..."}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Semester</span>
                    <span className="info-value">{currentSemester || "Calculating..."}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Program</span>
                    <span className="info-value">汉语学习项目</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Access Section */}
            <section className="services-section">
              <div className="section-header">
                <h2 className="section-title">Quick Access</h2>
              </div>
              <div className="services-grid">
                <Link href="/student-card" legacyBehavior>
                  <a className="service-card">
                    <div className="service-icon blue">
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
                    <h3>Student Card</h3>
                    <p>View your digital student ID</p>
                  </a>
                </Link>

                <Link href="/transcript" legacyBehavior>
                  <a className="service-card">
                    <div className="service-icon green">
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
                    <h3>Transcript</h3>
                    <p>View your academic record</p>
                  </a>
                </Link>

                <a
                  href={`https://mail.google.com/a/${
                    initialEmail?.split("@")[1] || "kzxy.edu.kg"
                  }?Email=${encodeURIComponent(initialEmail || "")}`}
                  className="service-card"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="service-icon red">
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
                  <h3>Email</h3>
                  <p>Access your student email</p>
                </a>

                <Link href="/aliases" legacyBehavior>
                  <a className="service-card">
                    <div className="service-icon purple">
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
                    <h3>Email Aliases</h3>
                    <p>Manage additional email addresses</p>
                  </a>
                </Link>
              </div>
            </section>

            {/* External Tools Section */}
            <section className="tools-section">
              <div className="section-header">
                <h2 className="section-title">External Tools</h2>
              </div>
              <div className="tools-grid">
                <a href="https://account.adobe.com/" className="tool-card" target="_blank" rel="noopener noreferrer">
                  <div className="tool-icon">
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
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                  </div>
                  <div className="tool-info">
                    <h3>Adobe Express</h3>
                    <p>Create graphics, videos, and web pages</p>
                  </div>
                  <div className="tool-action">
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
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </div>
                </a>

                <a href="https://www.canva.com/login" className="tool-card" target="_blank" rel="noopener noreferrer">
                  <div className="tool-icon">
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
                  <div className="tool-info">
                    <h3>Canva</h3>
                    <p>Design presentations and graphics</p>
                  </div>
                  <div className="tool-action">
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
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </div>
                </a>

                <Link href="/reset-password" legacyBehavior>
                  <a className="tool-card">
                    <div className="tool-icon">
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
                    <div className="tool-info">
                      <h3>Reset Password</h3>
                      <p>Change your account password</p>
                    </div>
                    <div className="tool-action">
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
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </div>
                  </a>
                </Link>
              </div>
            </section>
          </div>
        </main>

        {/* Delete Account Modal */}
        {isDeleteModalOpen && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>Delete Account</h3>
                <button className="modal-close" onClick={() => setIsDeleteModalOpen(false)}>
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
              <div className="modal-body">
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
                <h4>Are you sure you want to delete your account?</h4>
                <p>
                  This action is permanent and cannot be undone. All your data, including emails and personal
                  information, will be permanently removed.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? <span className="loading-spinner small"></span> : "Delete Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        /* Google-inspired Design System */
        :global(body) {
          margin: 0;
          padding: 0;
          font-family: 'Google Sans Text', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          background-color: #f8f9fa;
          color: #202124;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Error Page */
        .error-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
          background-color: #f8f9fa;
        }

        .error-container {
          max-width: 480px;
          width: 100%;
          text-align: center;
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
        }

        .error-icon {
          color: #ea4335;
          margin-bottom: 24px;
        }

        .error-container h1 {
          font-family: 'Google Sans', sans-serif;
          font-size: 24px;
          font-weight: 500;
          margin: 0 0 16px;
          color: #202124;
        }

        .error-container p {
          font-size: 16px;
          color: #5f6368;
          margin: 0 0 32px;
        }

        .error-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        /* Layout */
        .app-container {
          display: flex;
          min-height: 100vh;
        }

        /* Sidebar */
        .sidebar {
          width: 280px;
          background-color: white;
          border-right: 1px solid #dadce0;
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          z-index: 100;
          overflow-y: auto;
          transition: transform 0.3s ease;
        }

        .sidebar-header {
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #dadce0;
        }

        .sidebar-logo {
          height: 40px;
          width: auto;
        }

        .close-menu-btn {
          display: none;
          background: none;
          border: none;
          color: #5f6368;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
        }

        .close-menu-btn:hover {
          background-color: #f1f3f4;
        }

        .sidebar-user {
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid #dadce0;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          background-color: #4285f4;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Google Sans', sans-serif;
          font-size: 18px;
          font-weight: 500;
        }

        .user-info {
          flex: 1;
          min-width: 0;
        }

        .user-name {
          font-family: 'Google Sans', sans-serif;
          font-size: 16px;
          font-weight: 500;
          margin: 0 0 4px;
          color: #202124;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-email {
          font-size: 14px;
          color: #5f6368;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-nav {
          flex: 1;
          padding: 16px 8px;
          overflow-y: auto;
        }

        .nav-section {
          margin-bottom: 24px;
        }

        .nav-title {
          font-family: 'Google Sans', sans-serif;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          color: #5f6368;
          margin: 0 0 8px 16px;
          letter-spacing: 0.5px;
        }

        .nav-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .nav-item {
          margin: 2px 0;
        }

        .nav-link {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-radius: 0 16px 16px 0;
          color: #202124;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s;
          gap: 16px;
          cursor: pointer;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
        }

        .nav-link:hover {
          background-color: #f1f3f4;
        }

        .nav-item.active .nav-link {
          background-color: #e8f0fe;
          color: #1a73e8;
        }

        .nav-item.active .nav-link svg {
          color: #1a73e8;
        }

        .nav-link svg {
          color: #5f6368;
          flex-shrink: 0;
        }

        .nav-link.logout {
          color: #5f6368;
        }

        .nav-link.delete {
          color: #ea4335;
        }

        .nav-link.delete svg {
          color: #ea4335;
        }

        .sidebar-footer {
          padding: 16px 24px;
          border-top: 1px solid #dadce0;
          font-size: 12px;
          color: #5f6368;
          text-align: center;
        }

        .sidebar-footer p {
          margin: 0;
        }

        .sidebar-footer a {
          color: #1a73e8;
          text-decoration: none;
        }

        .sidebar-footer a:hover {
          text-decoration: underline;
        }

        /* Main Content */
        .main-content {
          flex: 1;
          margin-left: 280px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Top Bar */
        .top-bar {
          height: 64px;
          background-color: white;
          border-bottom: 1px solid #dadce0;
          display: flex;
          align-items: center;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .menu-toggle {
          display: none;
          background: none;
          border: none;
          color: #5f6368;
          cursor: pointer;
          padding: 8px;
          margin-right: 16px;
          border-radius: 50%;
        }

        .menu-toggle:hover {
          background-color: #f1f3f4;
        }

        .page-title {
          font-family: 'Google Sans', sans-serif;
          font-size: 20px;
          font-weight: 500;
          color: #202124;
          margin: 0;
          flex: 1;
        }

        .top-bar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .logout-btn {
          background: none;
          border: none;
          color: #5f6368;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          display: none;
        }

        .logout-btn:hover {
          background-color: #f1f3f4;
        }

        /* Alert */
        .alert {
          background-color: #fef7e0;
          color: #b06000;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 16px 24px 0;
          border-radius: 8px;
          font-size: 14px;
        }

        .alert svg {
          flex-shrink: 0;
          color: #f29900;
        }

        /* Content */
        .content {
          flex: 1;
          padding: 24px;
        }

        /* Welcome Section */
        .welcome-section {
          margin-bottom: 32px;
        }

        .welcome-text h2 {
          font-family: 'Google Sans', sans-serif;
          font-size: 28px;
          font-weight: 400;
          color: #202124;
          margin: 0 0 8px;
        }

        .welcome-text p {
          font-size: 16px;
          color: #5f6368;
          margin: 0;
        }

        /* Section Styling */
        .section-header {
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .section-title {
          font-family: 'Google Sans', sans-serif;
          font-size: 20px;
          font-weight: 500;
          color: #202124;
          margin: 0;
        }

        /* Info Section */
        .info-section {
          margin-bottom: 32px;
        }

        .info-card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
          padding: 24px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 24px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
        }

        .info-label {
          font-size: 12px;
          font-weight: 500;
          color: #5f6368;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-value {
          font-size: 16px;
          color: #202124;
          word-break: break-word;
        }

        .info-value.highlight {
          color: #1a73e8;
          font-family: monospace;
          font-weight: 500;
        }

        /* Services Section */
        .services-section {
          margin-bottom: 32px;
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
        }

        .service-card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
          padding: 24px;
          text-decoration: none;
          color: inherit;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transition: box-shadow 0.2s, transform 0.2s;
        }

        .service-card:hover {
          box-shadow: 0 4px 8px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 0 rgba(60, 64, 67, 0.15);
          transform: translateY(-2px);
        }

        .service-icon {
          width: 56px;
          height: 56px;
          border-radius: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .service-icon svg {
          color: white;
        }

        .service-icon.blue {
          background-color: #4285f4;
        }

        .service-icon.green {
          background-color: #34a853;
        }

        .service-icon.red {
          background-color: #ea4335;
        }

        .service-icon.purple {
          background-color: #9c27b0;
        }

        .service-card h3 {
          font-family: 'Google Sans', sans-serif;
          font-size: 16px;
          font-weight: 500;
          color: #202124;
          margin: 0 0 8px;
        }

        .service-card p {
          font-size: 14px;
          color: #5f6368;
          margin: 0;
        }

        /* Tools Section */
        .tools-section {
          margin-bottom: 32px;
        }

        .tools-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .tool-card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
          padding: 16px;
          text-decoration: none;
          color: inherit;
          display: flex;
          align-items: center;
          transition: background-color 0.2s;
        }

        .tool-card:hover {
          background-color: #f8f9fa;
        }

        .tool-icon {
          width: 48px;
          height: 48px;
          border-radius: 24px;
          background-color: #f1f3f4;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 16px;
          flex-shrink: 0;
        }

        .tool-icon svg {
          color: #5f6368;
        }

        .tool-info {
          flex: 1;
          min-width: 0;
        }

        .tool-info h3 {
          font-family: 'Google Sans', sans-serif;
          font-size: 16px;
          font-weight: 500;
          color: #202124;
          margin: 0 0 4px;
        }

        .tool-info p {
          font-size: 14px;
          color: #5f6368;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tool-action {
          color: #5f6368;
          margin-left: 16px;
          flex-shrink: 0;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(32, 33, 36, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
        }

        .modal {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 24px 38px 3px rgba(0, 0, 0, 0.14), 0 9px 46px 8px rgba(0, 0, 0, 0.12), 0 11px 15px -7px rgba(0, 0, 0, 0.2);
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          animation: modal-in 0.2s ease-out;
        }

        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .modal-header {
          padding: 16px 24px;
          border-bottom: 1px solid #dadce0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-header h3 {
          font-family: 'Google Sans', sans-serif;
          font-size: 18px;
          font-weight: 500;
          color: #202124;
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          color: #5f6368;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-close:hover {
          background-color: #f1f3f4;
        }

        .modal-body {
          padding: 24px;
          overflow-y: auto;
          text-align: center;
        }

        .modal-icon {
          margin-bottom: 24px;
        }

        .modal-icon.warning {
          color: #ea4335;
        }

        .modal-body h4 {
          font-family: 'Google Sans', sans-serif;
          font-size: 16px;
          font-weight: 500;
          color: #202124;
          margin: 0 0 16px;
        }

        .modal-body p {
          font-size: 14px;
          color: #5f6368;
          margin: 0;
          line-height: 1.5;
        }

        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #dadce0;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        /* Buttons */
        .btn {
          font-family: 'Google Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          padding: 8px 24px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 36px;
        }

        .btn-primary {
          background-color: #1a73e8;
          color: white;
        }

        .btn-primary:hover {
          background-color: #1765cc;
        }

        .btn-secondary {
          background-color: transparent;
          color: #1a73e8;
        }

        .btn-secondary:hover {
          background-color: #f1f3f4;
        }

        .btn-danger {
          background-color: #ea4335;
          color: white;
        }

        .btn-danger:hover {
          background-color: #d93025;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Loading Spinner */
        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }

        .loading-spinner.small {
          width: 16px;
          height: 16px;
          border-width: 2px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Responsive Styles */
        @media (max-width: 1024px) {
          .services-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
            box-shadow: 0 8px 10px -5px rgba(0, 0, 0, 0.2), 0 16px 24px 2px rgba(0, 0, 0, 0.14), 0 6px 30px 5px rgba(0, 0, 0, 0.12);
          }

          .sidebar-open {
            transform: translateX(0);
          }

          .close-menu-btn {
            display: block;
          }

          .main-content {
            margin-left: 0;
          }

          .menu-toggle {
            display: block;
          }

          .logout-btn {
            display: block;
          }

          .info-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          }

          .services-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          }
        }

        @media (max-width: 480px) {
          .content {
            padding: 16px;
          }

          .welcome-text h2 {
            font-size: 24px;
          }

          .section-title {
            font-size: 18px;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .services-grid {
            grid-template-columns: 1fr;
          }

          .modal {
            max-width: 100%;
          }
        }
      `}</style>
    </>
  )
}
