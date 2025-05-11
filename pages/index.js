"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import Head from "next/head"

export default function Home() {
  const router = useRouter()
  const { error } = router.query
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (error) {
      const messages = {
        invalid_state: "Authentication error: Invalid state parameter",
        no_code: "Authentication error: No authorization code received",
        token_exchange_failed: "Authentication error: Failed to exchange token",
        profile_incomplete: "Authentication error: Incomplete profile information",
        google_fetch_failed: "Authentication error: Failed to fetch Google user data",
        callback_exception: "Authentication error: An unexpected error occurred",
        profile_fetch_failed_no_fallback: "Authentication error: Could not retrieve profile information",
      }
      setErrorMessage(messages[error] || "An unknown error occurred")
    }
  }, [error])

  const handleSignIn = () => {
    setIsLoading(true)
    window.location.href = "/api/oauth2/initiate"
  }

  return (
    <>
      <Head>
        <title>Confucius Institute - Sign In</title>
        <meta name="description" content="Sign in to the Confucius Institute Student Portal" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="login-container">
        <div className="login-content">
          <div className="left-panel">
            <div className="brand-container">
              <img
                src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png"
                alt="Confucius Institute Logo"
                className="logo"
              />
              <h1 className="brand-name">Confucius Institute</h1>
            </div>
            <div className="welcome-text">
              <h2>Welcome to the Student Portal</h2>
              <p>Access your courses, transcripts, and student resources in one place.</p>
            </div>
            <div className="features">
              <div className="feature-item">
                <div className="feature-icon">📚</div>
                <div className="feature-text">
                  <h3>Course Materials</h3>
                  <p>Access all your learning resources</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🎓</div>
                <div className="feature-text">
                  <h3>Academic Records</h3>
                  <p>View your grades and transcripts</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📝</div>
                <div className="feature-text">
                  <h3>Student Services</h3>
                  <p>Manage your student account</p>
                </div>
              </div>
            </div>
          </div>

          <div className="right-panel">
            <div className="login-box">
              <div className="login-header">
                <h2>Sign in</h2>
                <p>Use your school email to continue</p>
              </div>

              {errorMessage && (
                <div className="error-message">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
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
                  {errorMessage}
                </div>
              )}

              <button onClick={handleSignIn} disabled={isLoading} className="google-signin-button">
                {isLoading ? (
                  <div className="spinner"></div>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 186.69 190.5">
                      <g transform="translate(1184.583 765.171)">
                        <path
                          d="M-1089.333-687.239v36.888h51.262c-2.251 11.863-9.006 21.908-19.137 28.662l30.913 23.986c18.011-16.625 28.402-41.044 28.402-70.052 0-6.754-.606-13.249-1.732-19.483z"
                          fill="#4285f4"
                        />
                        <path
                          d="M-1142.714-651.791l-6.972 5.337-24.679 19.223h0c15.673 31.086 47.796 52.561 85.03 52.561 25.717 0 47.278-8.486 63.038-23.033l-30.913-23.986c-8.486 5.715-19.31 9.179-32.125 9.179-24.765 0-45.806-16.712-53.34-39.226z"
                          fill="#34a853"
                        />
                        <path
                          d="M-1174.365-712.61c-6.494 12.815-10.217 27.276-10.217 42.689s3.723 29.874 10.217 42.689c0 .086 31.693-24.592 31.693-24.592-1.905-5.715-3.031-11.776-3.031-18.098s1.126-12.383 3.031-18.098z"
                          fill="#fbbc05"
                        />
                        <path
                          d="M-1089.333-727.244c14.028 0 26.497 4.849 36.455 14.201l27.276-27.276c-16.539-15.413-38.013-24.852-63.731-24.852-37.234 0-69.359 21.388-85.032 52.561l31.692 24.592c7.533-22.514 28.575-39.226 53.34-39.226z"
                          fill="#ea4335"
                        />
                      </g>
                    </svg>
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>

              <div className="login-footer">
                <p>
                  Only accounts with <strong>@kzxy.edu.kg</strong> domain are authorized
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(body) {
          margin: 0;
          padding: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          background-color: #f5f7fa;
          color: #333;
          height: 100vh;
        }

        .login-container {
          display: flex;
          min-height: 100vh;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .login-content {
          display: flex;
          width: 100%;
          max-width: 1100px;
          min-height: 600px;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
        }

        .left-panel {
          flex: 1;
          background: linear-gradient(135deg, #1d4ed8, #3b82f6);
          color: white;
          padding: 40px;
          display: flex;
          flex-direction: column;
        }

        .brand-container {
          display: flex;
          align-items: center;
          margin-bottom: 40px;
        }

        .logo {
          width: 50px;
          height: 50px;
          object-fit: contain;
          margin-right: 15px;
          background: white;
          border-radius: 10px;
          padding: 5px;
        }

        .brand-name {
          font-size: 24px;
          font-weight: 600;
          margin: 0;
        }

        .welcome-text {
          margin-bottom: 40px;
        }

        .welcome-text h2 {
          font-size: 32px;
          font-weight: 700;
          margin: 0 0 15px 0;
          line-height: 1.2;
        }

        .welcome-text p {
          font-size: 16px;
          margin: 0;
          opacity: 0.9;
          line-height: 1.6;
        }

        .features {
          margin-top: auto;
        }

        .feature-item {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
        }

        .feature-icon {
          font-size: 24px;
          margin-right: 15px;
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .feature-text h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 5px 0;
        }

        .feature-text p {
          font-size: 14px;
          margin: 0;
          opacity: 0.8;
        }

        .right-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .login-box {
          width: 100%;
          max-width: 360px;
        }

        .login-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .login-header h2 {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 10px 0;
          color: #1f2937;
        }

        .login-header p {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }

        .error-message {
          background-color: #fee2e2;
          color: #b91c1c;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .google-signin-button {
          width: 100%;
          padding: 12px 16px;
          background-color: white;
          color: #333;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .google-signin-button:hover {
          background-color: #f9fafb;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }

        .google-signin-button:active {
          transform: translateY(1px);
        }

        .google-signin-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(0, 0, 0, 0.1);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .login-footer {
          margin-top: 20px;
          text-align: center;
        }

        .login-footer p {
          font-size: 13px;
          color: #6b7280;
        }

        @media (max-width: 768px) {
          .login-content {
            flex-direction: column;
            min-height: auto;
          }

          .left-panel {
            padding: 30px;
          }

          .welcome-text h2 {
            font-size: 24px;
          }

          .features {
            margin-top: 30px;
            margin-bottom: 20px;
          }

          .right-panel {
            padding: 30px;
          }
        }
      `}</style>
    </>
  )
}
