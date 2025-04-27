import Head from 'next/head'
import { parse } from 'cookie'

export async function getServerSideProps({ req }) {
  const cookies = parse(req.headers.cookie || '')
  const oauthUsername = cookies.oauthUsername
  const oauthTrustLevel = parseInt(cookies.oauthTrustLevel || '0', 10)

  if (!oauthUsername || oauthTrustLevel < 3) {
    return { redirect: { destination: '/forbidden', permanent: false } }
  }

  return { props: { oauthUsername } }
}

export default function StudentPortal({ oauthUsername }) {
  return (
    <>
      <Head>
        <title>Student Portal - Confucius Institute</title>
      </Head>

      <div className="container">
        <div className="header">
          <img src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png" alt="Logo" className="logo" />
          <h1>Confucius Institute</h1>
          <h2>Student Portal</h2>
        </div>

        <div className="content">
          <p>Welcome, {oauthUsername}!</p>

          <div className="grid">
            <a href="/student-card" className="grid-item">🎓 View Student Card</a>
            <a href="/transcript" className="grid-item">📄 View Transcript</a>
            <a href="/aliases" className="grid-item">📧 Manage Email Aliases</a>
            <a href="/reset-password" className="grid-item">🔑 Reset Password</a>
          </div>

          <button onClick={() => window.location.href = '/api/logout'} className="logout-button">
            Logout
          </button>
        </div>
      </div>

      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          height: 80px;
          margin-bottom: 10px;
        }
        .content {
          text-align: center;
        }
        .grid {
          margin-top: 30px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .grid-item {
          background: #f0f2f5;
          padding: 20px;
          border-radius: 10px;
          text-decoration: none;
          color: #333;
          font-weight: bold;
        }
        .grid-item:hover {
          background: #dfe6f1;
        }
        .logout-button {
          margin-top: 30px;
          padding: 10px 20px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        .logout-button:hover {
          background: #c82333;
        }
      `}</style>
    </>
  )
}
