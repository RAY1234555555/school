"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import Head from "next/head"
import Link from "next/link"
import { parse } from "cookie"

// --- fetchGoogleUser Helper (Same as before) ---
async function fetchGoogleUser(email) {
  console.log(`[fetchGoogleUser - Portal] Attempting to get refresh token for: ${email}`)
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  })

  if (!tokenRes.ok) {
    const errorBody = await tokenRes.text()
    console.error(`[fetchGoogleUser - Portal] Failed to refresh Google token: ${tokenRes.status}`, errorBody)
    return null
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
    return null
  }
  console.log(`[fetchGoogleUser - Portal] Successfully fetched user data.`)
  return await userRes.json()
}

// --- getServerSideProps (Same as before) ---
export async function getServerSideProps({ req }) {
  console.log("[getServerSideProps - Portal] Starting...")
  const cookies = parse(req.headers.cookie || "")

  const oauthUsername = cookies.oauthUsername || null
  const studentIdFromCookie = cookies.oauthStudentId || cookies.oauthUserId || null
  const oauthFullNameFromCookie = cookies.oauthFullName || null
  const trustLevel = Number.parseInt(cookies.oauthTrustLevel || "0", 10)

  console.log("[getServerSideProps - Portal] Cookies parsed:", cookies)

  if (!oauthUsername || trustLevel < 3) {
    console.log("[getServerSideProps - Portal] Redirecting: No username or insufficient trust.")
    return { redirect: { destination: "/", permanent: false } }
  }

  const rawDom = process.env.EMAIL_DOMAIN
  const domain = rawDom && rawDom.startsWith("@") ? rawDom : "@" + (rawDom || "kzxy.edu.kg")
  const studentEmail = oauthUsername.includes("@") ? oauthUsername : `${oauthUsername}${domain}`

  console.log("[getServerSideProps - Portal] Attempting fetchGoogleUser for:", studentEmail)

  let googleUser
  let fetchError = null
  try {
    googleUser = await fetchGoogleUser(studentEmail)
  } catch (error) {
    console.error("[getServerSideProps - Portal] Error during fetchGoogleUser call:", error)
    fetchError = "Failed to communicate with Google services."
    googleUser = null
  }

  if (!googleUser) {
    console.log("[getServerSideProps - Portal] fetchGoogleUser failed or returned null.")
    if (studentIdFromCookie && oauthFullNameFromCookie) {
      console.warn("[getServerSideProps - Portal] Falling back to cookie data due to fetch failure.")
      return {
        props: {
          initialFullName: oauthFullNameFromCookie,
          initialEmail: studentEmail,
          initialStudentId: studentIdFromCookie,
          fetchError: "Could not refresh data from Google; showing last known info.",
        },
      }
    } else {
      console.log(
        "[getServerSideProps - Portal] Redirecting: fetchGoogleUser failed and no sufficient cookie fallback.",
      )
      return { redirect: { destination: "/?error=profile_fetch_failed_no_fallback", permanent: false } }
    }
  }

  console.log("[getServerSideProps - Portal] Google user data fetched successfully.")
  const fullName = googleUser.name
    ? `${googleUser.name.givenName || ""} ${googleUser.name.familyName || ""}`.trim()
    : oauthFullNameFromCookie || "Name Missing"
  const emailFromGoogle = googleUser.primaryEmail || studentEmail

  const finalStudentId = studentIdFromCookie || googleUser.id || null

  if (!finalStudentId) {
    console.error("[getServerSideProps - Portal] Error: Student ID is missing after Google fetch and cookie check.")
    return { props: { error: "Student ID is missing, cannot display portal." } }
  }

  console.log("[getServerSideProps - Portal] Data prepared:", { fullName, emailFromGoogle, finalStudentId })

  return {
    props: {
      initialFullName: fullName,
      initialEmail: emailFromGoogle,
      initialStudentId: finalStudentId,
      fetchError: null,
    },
  }
}

export default function StudentPortal({ initialFullName, initialEmail, initialStudentId, error, fetchError }) {
  const router = useRouter()
  const [currentSemester, setCurrentSemester] = useState("")
  const [currentYear, setCurrentYear] = useState("")
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState("dashboard")

  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    let semesterText = ""
    if (month >= 9 || month <= 2) semesterText = `${year} 秋冬`
    else if (month >= 3 && month <= 8) semesterText = `${year} 春夏`
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
          <h1>无法加载门户</h1>
          <p>{error}</p>
          <div className="error-actions">
            <a href="/student-portal" className="btn btn-primary">
              重试
            </a>
            <a href="/" className="btn btn-secondary">
              返回登录
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>学生门户 | 孔子学院</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="portal-container">
        {/* Header */}
        <header className="portal-header">
          <div className="header-content">
            <div className="logo-section">
              <img
                src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png"
                alt="孔子学院"
                className="portal-logo"
              />
              <h1 className="portal-title">孔子学院学生门户</h1>
            </div>
            <div className="user-section">
              <div className="search-bar">
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
                  className="search-icon"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" placeholder="搜索..." className="search-input" />
              </div>
              <div className="user-menu">
                <div className="user-avatar">{initialFullName ? initialFullName.charAt(0).toUpperCase() : "S"}</div>
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <p className="user-name">{initialFullName || "学生"}</p>
                    <p className="user-email">{initialEmail || "加载中..."}</p>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button onClick={handleLogout} disabled={isLoggingOut} className="dropdown-item">
                    {isLoggingOut ? "注销中..." : "注销"}
                  </button>
                  <button onClick={() => setIsDeleteModalOpen(true)} className="dropdown-item danger">
                    删除账户
                  </button>
                </div>
              </div>
            </div>
          </div>
          <nav className="portal-nav">
            <ul className="nav-tabs">
              <li className={`nav-tab ${activeTab === "dashboard" ? "active" : ""}`}>
                <button onClick={() => setActiveTab("dashboard")} className="tab-button">
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
                    className="tab-icon"
                  >
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  仪表板
                </button>
              </li>
              <li className={`nav-tab ${activeTab === "documents" ? "active" : ""}`}>
                <button onClick={() => setActiveTab("documents")} className="tab-button">
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
                    className="tab-icon"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  文档
                </button>
              </li>
              <li className={`nav-tab ${activeTab === "courses" ? "active" : ""}`}>
                <button onClick={() => setActiveTab("courses")} className="tab-button">
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
                    className="tab-icon"
                  >
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                  </svg>
                  课程
                </button>
              </li>
              <li className={`nav-tab ${activeTab === "tools" ? "active" : ""}`}>
                <button onClick={() => setActiveTab("tools")} className="tab-button">
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
                    className="tab-icon"
                  >
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                  </svg>
                  工具
                </button>
              </li>
              <li className={`nav-tab ${activeTab === "account" ? "active" : ""}`}>
                <button onClick={() => setActiveTab("account")} className="tab-button">
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
                    className="tab-icon"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  账户
                </button>
              </li>
            </ul>
          </nav>
        </header>

        {/* Alert Banner */}
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

        {/* Main Content */}
        <main className="portal-content">
          {activeTab === "dashboard" && (
            <>
              {/* Welcome Section */}
              <section className="welcome-section">
                <div className="welcome-content">
                  <h2>欢迎, {initialFullName || "学生"}!</h2>
                  <p>以下是您需要了解的 {currentSemester || "本学期"} 信息。</p>
                </div>
                <div className="welcome-actions">
                  <button className="action-button primary">
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
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    更新个人资料
                  </button>
                </div>
              </section>

              {/* Student Info Card */}
              <section className="info-card">
                <div className="card-header">
                  <h3 className="card-title">学生信息</h3>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">名字</span>
                    <span className="info-value">{initialFullName || "加载中..."}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">学生证</span>
                    <span className="info-value highlight">{initialStudentId || "加载中..."}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">电子邮件</span>
                    <span className="info-value">{initialEmail || "加载中..."}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">学期</span>
                    <span className="info-value">{currentSemester || "计算中..."}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">程序</span>
                    <span className="info-value">汉语学习项目</span>
                  </div>
                </div>
              </section>

              {/* Quick Links */}
              <section className="quick-links">
                <div className="section-header">
                  <h3 className="section-title">快速访问</h3>
                  <button className="section-action">
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
                      <circle cx="12" cy="12" r="1"></circle>
                      <circle cx="19" cy="12" r="1"></circle>
                      <circle cx="5" cy="12" r="1"></circle>
                    </svg>
                  </button>
                </div>
                <div className="links-grid">
                  <Link href="/student-card" legacyBehavior>
                    <a className="link-card">
                      <div className="link-icon blue">
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
                      <div className="link-text">
                        <h4>学生证</h4>
                        <p>查看您的数字学生证</p>
                      </div>
                    </a>
                  </Link>

                  <Link href="/transcript" legacyBehavior>
                    <a className="link-card">
                      <div className="link-icon green">
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
                      <div className="link-text">
                        <h4>成绩单</h4>
                        <p>查看您的学术记录</p>
                      </div>
                    </a>
                  </Link>

                  <Link href="/admission-letter" legacyBehavior>
                    <a className="link-card">
                      <div className="link-icon purple">
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
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                          <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                      </div>
                      <div className="link-text">
                        <h4>录取通知书</h4>
                        <p>查看您的录取通知书</p>
                      </div>
                    </a>
                  </Link>

                  <Link href="/tuition-receipt" legacyBehavior>
                    <a className="link-card">
                      <div className="link-icon red">
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
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                          <line x1="1" y1="10" x2="23" y2="10"></line>
                        </svg>
                      </div>
                      <div className="link-text">
                        <h4>学费收据</h4>
                        <p>查看您的学费支付收据</p>
                      </div>
                    </a>
                  </Link>

                  <a
                    href={`https://mail.google.com/a/${
                      initialEmail?.split("@")[1] || "kzxy.edu.kg"
                    }?Email=${encodeURIComponent(initialEmail || "")}`}
                    className="link-card"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="link-icon orange">
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
                    <div className="link-text">
                      <h4>电子邮件</h4>
                      <p>访问您的学生电子邮件</p>
                    </div>
                  </a>

                  <Link href="/aliases" legacyBehavior>
                    <a className="link-card">
                      <div className="link-icon teal">
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
                      <div className="link-text">
                        <h4>电子邮件别名</h4>
                        <p>管理其他电子邮件地址</p>
                      </div>
                    </a>
                  </Link>
                </div>
              </section>

              {/* External Tools */}
              <section className="external-tools">
                <div className="section-header">
                  <h3 className="section-title">外部工具</h3>
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
                    <div className="tool-text">
                      <h4>Adobe Express</h4>
                      <p>创建图形、视频和网页</p>
                    </div>
                    <div className="tool-action">
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
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
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
                    <div className="tool-text">
                      <h4>Canva 餐厅</h4>
                      <p>设计演示文稿和图形</p>
                    </div>
                    <div className="tool-action">
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
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </div>
                  </a>
                </div>
              </section>
            </>
          )}

          {activeTab === "documents" && (
            <section className="documents-section">
              <div className="section-header">
                <h3 className="section-title">文档</h3>
              </div>
              <div className="documents-grid">
                <Link href="/student-card" legacyBehavior>
                  <a className="document-card">
                    <div className="document-icon">
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
                    <div className="document-info">
                      <h4>学生证</h4>
                      <p>查看您的数字学生证</p>
                    </div>
                  </a>
                </Link>

                <Link href="/transcript" legacyBehavior>
                  <a className="document-card">
                    <div className="document-icon">
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
                    <div className="document-info">
                      <h4>成绩单</h4>
                      <p>查看您的学术记录</p>
                    </div>
                  </a>
                </Link>

                <Link href="/admission-letter" legacyBehavior>
                  <a className="document-card">
                    <div className="document-icon">
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
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                      </svg>
                    </div>
                    <div className="document-info">
                      <h4>录取通知书</h4>
                      <p>查看您的录取通知书</p>
                    </div>
                  </a>
                </Link>

                <Link href="/tuition-receipt" legacyBehavior>
                  <a className="document-card">
                    <div className="document-icon">
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
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                        <line x1="1" y1="10" x2="23" y2="10"></line>
                      </svg>
                    </div>
                    <div className="document-info">
                      <h4>学费收据</h4>
                      <p>查看您的学费支付收据</p>
                    </div>
                  </a>
                </Link>
              </div>
            </section>
          )}

          {activeTab === "courses" && (
            <section className="courses-section">
              <div className="section-header">
                <h3 className="section-title">课程</h3>
              </div>
              <div className="courses-grid">
                <div className="course-card">
                  <div className="course-header">
                    <h4>CHN101</h4>
                    <span className="course-badge">进行中</span>
                  </div>
                  <h3 className="course-title">Elementary Chinese Speaking</h3>
                  <p className="course-info">
                    <span className="course-term">Fall 2025</span>
                    <span className="course-credits">3.0 学分</span>
                  </p>
                  <div className="course-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: "45%" }}></div>
                    </div>
                    <span className="progress-text">45% 完成</span>
                  </div>
                </div>

                <div className="course-card">
                  <div className="course-header">
                    <h4>CHN102</h4>
                    <span className="course-badge">进行中</span>
                  </div>
                  \
