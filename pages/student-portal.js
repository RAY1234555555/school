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
                  <h3 className="course-title">Elementary Chinese Reading</h3>
                  <p className="course-info">
                    <span className="course-term">Fall 2025</span>
                    <span className="course-credits">3.0 学分</span>
                  </p>
                  <div className="course-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: "30%" }}></div>
                    </div>
                    <span className="progress-text">30% 完成</span>
                  </div>
                </div>

                <div className="course-card">
                  <div className="course-header">
                    <h4>CHN201</h4>
                    <span className="course-badge">进行中</span>
                  </div>
                  <h3 className="course-title">Intermediate Chinese Listening</h3>
                  <p className="course-info">
                    <span className="course-term">Fall 2025</span>
                    <span className="course-credits">3.0 学分</span>
                  </p>
                  <div className="course-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: "25%" }}></div>
                    </div>
                    <span className="progress-text">25% 完成</span>
                  </div>
                </div>

                <div className="course-card">
                  <div className="course-header">
                    <h4>CUL100</h4>
                    <span className="course-badge">进行中</span>
                  </div>
                  <h3 className="course-title">Chinese Culture and Society</h3>
                  <p className="course-info">
                    <span className="course-term">Fall 2025</span>
                    <span className="course-credits">3.0 学分</span>
                  </p>
                  <div className="course-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: "35%" }}></div>
                    </div>
                    <span className="progress-text">35% 完成</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === "tools" && (
            <section className="tools-section">
              <div className="section-header">
                <h3 className="section-title">工具</h3>
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
          )}

          {activeTab === "account" && (
            <section className="account-section">
              <div className="section-header">
                <h3 className="section-title">账户管理</h3>
              </div>
              <div className="account-info">
                <div className="account-avatar">{initialFullName ? initialFullName.charAt(0).toUpperCase() : "S"}</div>
                <div className="account-details">
                  <h4>{initialFullName || "学生"}</h4>
                  <p>{initialEmail || "加载中..."}</p>
                  <p>学生ID: {initialStudentId || "加载中..."}</p>
                </div>
              </div>
              <div className="account-actions">
                <Link href="/reset-password" legacyBehavior>
                  <a className="account-action-button">
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
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    重置密码
                  </a>
                </Link>
                <button onClick={() => setIsDeleteModalOpen(true)} className="account-action-button danger">
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
                  删除账户
                </button>
              </div>
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="portal-footer">
          <p>
            © {currentYear} 孔子学院 | <a href="https://kzxy.edu.kg">kzxy.edu.kg</a>
          </p>
        </footer>

        {/* Delete Account Modal */}
        {isDeleteModalOpen && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>删除账户</h3>
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
                <h4>您确定要删除您的账户吗？</h4>
                <p>此操作是永久性的，无法撤消。您的所有数据，包括电子邮件和个人信息，将被永久删除。</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                  取消
                </button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? "处理中..." : "删除账户"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        /* Base Styles */
        :global(body) {
          margin: 0;
          padding: 0;
          font-family: 'Google Sans', 'Noto Sans SC', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          background-color: #f8f9fa;
          color: #202124;
          line-height: 1.5;
        }

        /* Portal Container */
        .portal-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0;
        }

        /* Header */
        .portal-header {
          background-color: #fff;
          color: #202124;
          box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3), 0 2px 6px 2px rgba(60, 64, 67, 0.15);
          margin-bottom: 20px;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
        }

        .logo-section {
          display: flex;
          align-items: center;
        }

        .portal-logo {
          height: 40px;
          margin-right: 12px;
        }

        .portal-title {
          font-size: 20px;
          margin: 0;
          font-weight: 500;
          color: #1a73e8;
        }

        .user-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .search-bar {
          display: flex;
          align-items: center;
          background-color: #f1f3f4;
          border-radius: 24px;
          padding: 8px 16px;
          width: 300px;
          transition: background-color 0.2s;
        }

        .search-bar:hover {
          background-color: #e8eaed;
        }

        .search-icon {
          color: #5f6368;
          margin-right: 8px;
        }

        .search-input {
          border: none;
          background: transparent;
          outline: none;
          width: 100%;
          font-size: 14px;
          color: #202124;
        }

        .user-menu {
          position: relative;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background-color: #1a73e8;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 500;
          cursor: pointer;
          transition: box-shadow 0.2s;
        }

        .user-avatar:hover {
          box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3);
        }

        .user-dropdown {
          position: absolute;
          top: 45px;
          right: 0;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(60, 64, 67, 0.3);
          width: 280px;
          z-index: 10;
          display: none;
        }

        .user-menu:hover .user-dropdown {
          display: block;
        }

        .dropdown-header {
          padding: 16px;
          text-align: center;
          border-bottom: 1px solid #e8eaed;
        }

        .dropdown-header .user-name {
          font-weight: 500;
          margin: 0 0 4px 0;
        }

        .dropdown-header .user-email {
          margin: 0;
          font-size: 14px;
          color: #5f6368;
        }

        .dropdown-divider {
          height: 1px;
          background-color: #e8eaed;
          margin: 8px 0;
        }

        .dropdown-item {
          display: block;
          width: 100%;
          padding: 12px 16px;
          text-align: left;
          background: none;
          border: none;
          font-size: 14px;
          color: #202124;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .dropdown-item:hover {
          background-color: #f1f3f4;
        }

        .dropdown-item.danger {
          color: #d93025;
        }

        .dropdown-item.danger:hover {
          background-color: #fce8e6;
        }

        /* Navigation */
        .portal-nav {
          background-color: #fff;
          border-top: 1px solid #e8eaed;
        }

        .nav-tabs {
          display: flex;
          list-style: none;
          margin: 0;
          padding: 0;
          overflow-x: auto;
        }

        .nav-tab {
          margin: 0;
        }

        .tab-button {
          display: flex;
          align-items: center;
          padding: 12px 20px;
          background: none;
          border: none;
          color: #5f6368;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s;
          position: relative;
        }

        .tab-button:hover {
          color: #1a73e8;
        }

        .tab-icon {
          margin-right: 8px;
        }

        .nav-tab.active .tab-button {
          color: #1a73e8;
        }

        .nav-tab.active .tab-button::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background-color: #1a73e8;
        }

        /* Alert Banner */
        .alert-banner {
          background-color: #fef7e0;
          color: #b06000;
          padding: 12px 20px;
          border-radius: 8px;
          margin: 0 20px 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Main Content */
        .portal-content {
          padding: 0 20px 20px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }

        /* Welcome Section */
        .welcome-section {
          background-color: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .welcome-content h2 {
          margin-top: 0;
          margin-bottom: 8px;
          color: #202124;
          font-size: 22px;
          font-weight: 500;
        }

        .welcome-content p {
          margin: 0;
          color: #5f6368;
        }

        .welcome-actions {
          display: flex;
          gap: 12px;
        }

        .action-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          border: none;
        }

        .action-button.primary {
          background-color: #1a73e8;
          color: white;
        }

        .action-button.primary:hover {
          background-color: #1765cc;
        }

        /* Info Card */
        .info-card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
          overflow: hidden;
        }

        .card-header {
          padding: 16px 24px;
          border-bottom: 1px solid #e8eaed;
        }

        .card-title {
          margin: 0;
          color: #202124;
          font-size: 16px;
          font-weight: 500;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          padding: 24px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
        }

        .info-label {
          font-size: 12px;
          color: #5f6368;
          margin-bottom: 4px;
        }

        .info-value {
          font-size: 14px;
          font-weight: 500;
          color: #202124;
        }

        .info-value.highlight {
          color: #1a73e8;
          font-family: monospace;
          font-size: 16px;
        }

        /* Section Styles */
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .section-title {
          margin: 0;
          color: #202124;
          font-size: 16px;
          font-weight: 500;
        }

        .section-action {
          background: none;
          border: none;
          color: #5f6368;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: background-color 0.2s;
        }

        .section-action:hover {
          background-color: #f1f3f4;
        }

        /* Quick Links */
        .quick-links, .external-tools, .documents-section, .courses-section, .tools-section, .account-section {
          background-color: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
        }

        .links-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .link-card {
          display: flex;
          align-items: center;
          padding: 16px;
          border-radius: 8px;
          background-color: #f8f9fa;
          text-decoration: none;
          color: inherit;
          transition: box-shadow 0.2s, transform 0.2s;
        }

        .link-card:hover {
          box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3);
          transform: translateY(-2px);
        }

        .link-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 16px;
          flex-shrink: 0;
        }

        .link-icon svg {
          color: white;
        }

        .link-icon.blue {
          background-color: #1a73e8;
        }

        .link-icon.green {
          background-color: #34a853;
        }

        .link-icon.red {
          background-color: #ea4335;
        }

        .link-icon.purple {
          background-color: #9334e6;
        }

        .link-icon.orange {
          background-color: #fbbc04;
        }

        .link-icon.teal {
          background-color: #00bfa5;
        }

        .link-text h4 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 500;
          color: #202124;
        }

        .link-text p {
          margin: 0;
          font-size: 14px;
          color: #5f6368;
        }

        /* Tools Grid */
        .tools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .tool-card {
          display: flex;
          align-items: center;
          padding: 16px;
          border-radius: 8px;
          background-color: #f8f9fa;
          text-decoration: none;
          color: inherit;
          transition: background-color 0.2s;
          position: relative;
        }

        .tool-card:hover {
          background-color: #f1f3f4;
        }

        .tool-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: #e8eaed;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 16px;
          flex-shrink: 0;
        }

        .tool-icon svg {
          color: #5f6368;
        }

        .tool-text {
          flex: 1;
        }

        .tool-text h4 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 500;
          color: #202124;
        }

        .tool-text p {
          margin: 0;
          font-size: 14px;
          color: #5f6368;
        }

        .tool-action {
          color: #5f6368;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .tool-card:hover .tool-action {
          opacity: 1;
        }

        /* Documents Section */
        .documents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 16px;
        }

        .document-card {
          display: flex;
          align-items: center;
          padding: 16px;
          border-radius: 8px;
          background-color: #f8f9fa;
          text-decoration: none;
          color: inherit;
          transition: box-shadow 0.2s;
        }

        .document-card:hover {
          box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3);
        }

        .document-icon {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          background-color: #e8eaed;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 16px;
          flex-shrink: 0;
        }

        .document-info h4 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 500;
        }

        .document-info p {
          margin: 0;
          font-size: 14px;
          color: #5f6368;
        }

        /* Courses Section */
        .courses-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .course-card {
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          transition: box-shadow 0.2s;
        }

        .course-card:hover {
          box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3);
        }

        .course-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .course-header h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          color: #5f6368;
        }

        .course-badge {
          background-color: #e6f4ea;
          color: #137333;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 500;
        }

        .course-title {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 500;
          color: #202124;
        }

        .course-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 14px;
          color: #5f6368;
        }

        .course-progress {
          margin-top: 12px;
        }

        .progress-bar {
          height: 4px;
          background-color: #e8eaed;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .progress-fill {
          height: 100%;
          background-color: #1a73e8;
        }

        .progress-text {
          font-size: 12px;
          color: #5f6368;
        }

        /* Account Section */
        .account-info {
          display: flex;
          align-items: center;
          margin-bottom: 24px;
        }

        .account-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background-color: #1a73e8;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 500;
          margin-right: 20px;
        }

        .account-details h4 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 500;
        }

        .account-details p {
          margin: 0 0 4px 0;
          font-size: 14px;
          color: #5f6368;
        }

        .account-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 24px;
        }

        .account-action-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 4px;
          background-color: #f8f9fa;
          border: 1px solid #dadce0;
          color: #202124;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          text-decoration: none;
        }

        .account-action-button:hover {
          background-color: #f1f3f4;
        }

        .account-action-button.danger {
          color: #d93025;
          border-color: #fad2cf;
        }

        .account-action-button.danger:hover {
          background-color: #fce8e6;
        }

        /* Footer */
        .portal-footer {
          text-align: center;
          margin-top: 30px;
          padding: 20px;
          color: #5f6368;
          font-size: 14px;
          border-top: 1px solid #e8eaed;
        }

        .portal-footer a {
          color: #1a73e8;
          text-decoration: none;
        }

        .portal-footer a:hover {
          text-decoration: underline;
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
          padding: 20px;
        }

        .modal {
          background-color: white;
          border-radius: 8px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
          overflow: hidden;
        }

        .modal-header {
          padding: 16px 24px;
          border-bottom: 1px solid #e8eaed;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
          color: #202124;
        }

        .modal-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #5f6368;
          padding: 8px;
          border-radius: 50%;
          transition: background-color 0.2s;
        }

        .modal-close:hover {
          background-color: #f1f3f4;
        }

        .modal-body {
          padding: 24px;
          text-align: center;
        }

        .modal-icon.warning {
          color: #d93025;
          margin-bottom: 16px;
        }

        .modal-body h4 {
          margin: 0 0 12px 0;
          font-size: 18px;
          font-weight: 500;
          color: #d93025;
        }

        .modal-body p {
          margin: 0;
          color: #5f6368;
          line-height: 1.5;
        }

        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e8eaed;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .btn {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: background-color 0.2s;
        }

        .btn-secondary {
          background-color: #f8f9fa;
          color: #202124;
          border: 1px solid #dadce0;
        }

        .btn-secondary:hover {
          background-color: #f1f3f4;
        }

        .btn-danger {
          background-color: #d93025;
          color: white;
        }

        .btn-danger:hover {
          background-color: #c5221f;
        }

        .btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* Responsive Styles */
        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            align-items: flex-start;
          }

          .logo-section {
            margin-bottom: 12px;
          }

          .user-section {
            width: 100%;
            justify-content: space-between;
          }

          .search-bar {
            width: 100%;
            max-width: 250px;
          }

          .welcome-section {
            flex-direction: column;
            align-items: flex-start;
          }

          .welcome-actions {
            margin-top: 16px;
          }

          .info-grid, .links-grid, .tools-grid, .documents-grid, .courses-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .portal-container {
            padding: 0;
          }

          .header-content, .portal-content {
            padding: 12px;
          }

          .portal-title {
            font-size: 18px;
          }

          .search-bar {
            display: none;
          }

          .nav-tabs {
            justify-content: space-between;
          }

          .tab-button {
            padding: 12px 8px;
            font-size: 12px;
          }

          .welcome-section, .info-card, .quick-links, .external-tools, .documents-section, .courses-section, .tools-section, .account-section {
            padding: 16px;
          }

          .welcome-content h2 {
            font-size: 20px;
          }

          .card-title, .section-title {
            font-size: 16px;
          }
        }
      `}</style>
    </>
  )
}
