import Head from 'next/head'
import { parse } from 'cookie'

export async function getServerSideProps({ req }) {
  const cookies = parse(req.headers.cookie || '')
  const oauthUsername = cookies.oauthUsername
  const oauthTrustLevel = parseInt(cookies.oauthTrustLevel || '0', 10)

  if (!oauthUsername || oauthTrustLevel < 3) {
    return { redirect: { destination: '/forbidden', permanent: false } }
  }

  return { props: {} }
}

export default function ResetPassword() {
  return (
    <>
      <Head>
        <title>Reset Password - Confucius Institute</title>
      </Head>

      <div className="container">
        <div className="card">
          <h1>Reset Your Password</h1>
          <p>Please go to your Google Account settings to change your password securely.</p>
          <a
            href="https://myaccount.google.com/security"
            target="_blank"
            rel="noopener noreferrer"
            className="reset-button"
          >
            Go to Google Account
          </a>
        </div>
      </div>

      <style jsx>{`
        .container {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: #f0f2f5;
          padding: 20px;
        }
        .card {
          background: #fff;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 500px;
          width: 100%;
        }
        h1 {
          margin-bottom: 20px;
        }
        p {
          margin-bottom: 30px;
          color: #666;
        }
        .reset-button {
          display: inline-block;
          padding: 10px 20px;
          background: #0070f3;
          color: white;
          border-radius: 6px;
          text-decoration: none;
          font-size: 16px;
        }
        .reset-button:hover {
          background: #005bb5;
        }
      `}</style>
    </>
  )
}
