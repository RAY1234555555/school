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

export default function StudentPortal({ initialFullName, initialEmail, initialStudentId, error, fetchError }) {
  const router = useRouter()
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
        <title>学生仪表板 | 孔子学院</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Noto+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="portal-container">
        {/* Header */}
        <header className="portal-header">
          <div className="logo-section">
            <img
              src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png"
              alt="孔子学院"
              className="portal-logo"
            />
            <h1 className="portal-title">孔子学院学生门户</h1>
          </div>
          <div className="user-section">
            <div className="user-info">
              <span className="user-name">{initialFullName || "学生"}</span>
              <span className="user-email">{initialEmail || "加载中..."}</span>
            </div>
            <button onClick={handleLogout} disabled={isLoggingOut} className="logout-button">
              {isLoggingOut ? "注销中..." : "注销"}
            </button>
          </div>
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
          {/* Welcome Section */}
          <section className="welcome-section">
            <h2>欢迎, {initialFullName || "学生"}!</h2>
            <p>以下是您需要了解的 {currentSemester || "本学期"} 信息。</p>
          </section>

          {/* Student Info Card */}
          <section className="info-card">
            <h3 className="card-title">学生信息</h3>
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
            <h3 className="section-title">快速访问</h3>
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

              <a
                href={`https://mail.google.com/a/${
                  initialEmail?.split("@")[1] || "kzxy.edu.kg"
                }?Email=${encodeURIComponent(initialEmail || "")}`}
                className="link-card"
                target="_blank"
                rel="noopener noreferrer"
              >
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

              <Link href="/reset-password" legacyBehavior>
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
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <div className="link-text">
                    <h4>重置密码</h4>
                    <p>更改您的账户密码</p>
                  </div>
                </a>
              </Link>
            </div>
          </section>

          {/* External Tools */}
          <section className="external-tools">
            <h3 className="section-title">外部工具</h3>
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
              </a>
            </div>
          </section>

          {/* Account Management */}
          <section className="account-management">
            <h3 className="section-title">账户管理</h3>
            <button onClick={() => setIsDeleteModalOpen(true)} className="delete-account-button">
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
              删除账户
            </button>
          </section>
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
          font-family: 'Noto Sans SC', 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          background-color: #f5f7fa;
          color: #333;
          line-height: 1.5;
        }

        /* Portal Container */
        .portal-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        /* Header */
        .portal-header {
          background-color: #0056b3;
          color: white;
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .logo-section {
          display: flex;
          align-items: center;
        }

        .portal-logo {
          height: 50px;
          margin-right: 15px;
        }

        .portal-title {
          font-size: 24px;
          margin: 0;
          font-weight: 600;
        }

        .user-section {
          display: flex;
          align-items: center;
        }

        .user-info {
          text-align: right;
          margin-right: 15px;
        }

        .user-name {
          display: block;
          font-size: 16px;
          font-weight: 600;
        }

        .user-email {
          display: block;
          font-size: 14px;
          opacity: 0.9;
        }

        .logout-button {
          background-color: rgba(255, 255, 255, 0.2);
          color: white;
          border: none;
          padding: 8px 15px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.3s;
        }

        .logout-button:hover {
          background-color: rgba(255, 255, 255, 0.3);
        }

        /* Alert Banner */
        .alert-banner {
          background-color: #fff3cd;
          color: #856404;
          padding: 12px 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Main Content */
        .portal-content {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }

        /* Welcome Section */
        .welcome-section {
          background-color: white;
          padding: 25px;
          border-radius: 10px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .welcome-section h2 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #0056b3;
          font-size: 22px;
        }

        .welcome-section p {
          margin: 0;
          color: #666;
        }

        /* Info Card */
        .info-card {
          background-color: white;
          padding: 25px;
          border-radius: 10px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .card-title {
          margin-top: 0;
          margin-bottom: 20px;
          color: #0056b3;
          font-size: 18px;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
        }

        .info-label {
          font-size: 14px;
          color: #666;
          margin-bottom: 5px;
        }

        .info-value {
          font-size: 16px;
          font-weight: 500;
        }

        .info-value.highlight {
          color: #0056b3;
          font-family: monospace;
        }

        /* Quick Links */
        .quick-links {
          background-color: white;
          padding: 25px;
          border-radius: 10px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .section-title {
          margin-top: 0;
          margin-bottom: 20px;
          color: #0056b3;
          font-size: 18px;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }

        .links-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 15px;
        }

        .link-card {
          display: flex;
          align-items: center;
          padding: 15px;
          border-radius: 8px;
          background-color: #f8f9fa;
          text-decoration: none;
          color: inherit;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .link-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .link-icon {
          width: 50px;
          height: 50px;
          border-radius: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 15px;
          flex-shrink: 0;
        }

        .link-icon svg {
          color: white;
        }

        .link-icon.blue {
          background-color: #0056b3;
        }

        .link-icon.green {
          background-color: #28a745;
        }

        .link-icon.red {
          background-color: #dc3545;
        }

        .link-icon.purple {
          background-color: #6f42c1;
        }

        .link-icon.orange {
          background-color: #fd7e14;
        }

        .link-icon.teal {
          background-color: #20c997;
        }

        .link-text h4 {
          margin: 0 0 5px 0;
          font-size: 16px;
        }

        .link-text p {
          margin: 0;
          font-size: 14px;
          color: #666;
        }

        /* External Tools */
        .external-tools {
          background-color: white;
          padding: 25px;
          border-radius: 10px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .tools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 15px;
        }

        .tool-card {
          display: flex;
          align-items: center;
          padding: 15px;
          border-radius: 8px;
          background-color: #f8f9fa;
          text-decoration: none;
          color: inherit;
          transition: background-color 0.2s;
        }

        .tool-card:hover {
          background-color: #e9ecef;
        }

        .tool-icon {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          background-color: #e9ecef;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 15px;
          flex-shrink: 0;
        }

        .tool-icon svg {
          color: #495057;
        }

        .tool-text h4 {
          margin: 0 0 5px 0;
          font-size: 16px;
        }

        .tool-text p {
          margin: 0;
          font-size: 14px;
          color: #666;
        }

        /* Account Management */
        .account-management {
          background-color: white;
          padding: 25px;
          border-radius: 10px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .delete-account-button {
          display: flex;
          align-items: center;
          gap: 8px;
          background-color: #f8d7da;
          color: #721c24;
          border: none;
          padding: 10px 15px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.3s;
        }

        .delete-account-button:hover {
          background-color: #f5c6cb;
        }

        /* Footer */
        .portal-footer {
          text-align: center;
          margin-top: 30px;
          padding: 20px;
          color: #6c757d;
          font-size: 14px;
        }

        .portal-footer a {
          color: #0056b3;
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
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal {
          background-color: white;
          border-radius: 10px;
          width: 100%;
          max-width: 500px;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
          overflow: hidden;
        }

        .modal-header {
          padding: 15px 20px;
          border-bottom: 1px solid #dee2e6;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          color: #0056b3;
        }

        .modal-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #6c757d;
          padding: 5px;
        }

        .modal-body {
          padding: 20px;
          text-align: center;
        }

        .modal-icon.warning {
          color: #dc3545;
          margin-bottom: 15px;
        }

        .modal-body h4 {
          margin: 0 0 10px 0;
          font-size: 18px;
          color: #dc3545;
        }

        .modal-body p {
          margin: 0;
          color: #6c757d;
          line-height: 1.5;
        }

        .modal-footer {
          padding: 15px 20px;
          border-top: 1px solid #dee2e6;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .btn {
          padding: 8px 16px;
          border-radius: 5px;
          font-size: 14px;
          cursor: pointer;
          border: none;
        }

        .btn-secondary {
          background-color: #6c757d;
          color: white;
        }

        .btn-danger {
          background-color: #dc3545;
          color: white;
        }

        .btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* Responsive Styles */
        @media (max-width: 768px) {
          .portal-header {
            flex-direction: column;
            text-align: center;
          }

          .logo-section {
            margin-bottom: 15px;
            flex-direction: column;
          }

          .portal-logo {
            margin-right: 0;
            margin-bottom: 10px;
          }

          .user-section {
            flex-direction: column;
          }

          .user-info {
            text-align: center;
            margin-right: 0;
            margin-bottom: 10px;
          }

          .info-grid, .links-grid, .tools-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .portal-container {
            padding: 10px;
          }

          .portal-header, .welcome-section, .info-card, .quick-links, .external-tools, .account-management {
            padding: 15px;
          }

          .portal-title {
            font-size: 20px;
          }

          .welcome-section h2 {
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
