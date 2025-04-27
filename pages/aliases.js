import Head from 'next/head'
import { parse } from 'cookie'

export async function getServerSideProps({ req }) {
  const cookies = parse(req.headers.cookie || '')
  const oauthUsername = cookies.oauthUsername
  const oauthTrustLevel = parseInt(cookies.oauthTrustLevel || '0', 10)

  if (!oauthUsername || oauthTrustLevel < 3) {
    return { redirect: { destination: '/forbidden', permanent: false } }
  }

  const rawDom = process.env.EMAIL_DOMAIN
  const domain = rawDom.startsWith('@') ? rawDom : '@' + rawDom

  const studentEmail = oauthUsername.includes('@')
    ? oauthUsername
    : `${oauthUsername}${domain}`

  return { props: { studentEmail } }
}

export default function Aliases({ studentEmail }) {
  const domain = studentEmail.split('@')[1]
  const prefix = 'kz_'

  return (
    <>
      <Head>
        <title>Manage Email Aliases - Confucius Institute</title>
      </Head>

      <div className="container">
        <div className="card">
          <div className="header">
            <img src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png" alt="Logo" className="logo" />
            <h1>Confucius Institute</h1>
            <h2>Manage Email Aliases</h2>
          </div>

          <div className="email-section">
            <p><strong>Student Email:</strong> {studentEmail}</p>
          </div>

          <div className="aliases-section">
            <h3>Existing Aliases</h3>
            <p>No aliases yet.</p>
          </div>

          <div className="add-alias-section">
            <form onSubmit={e => e.preventDefault()}>
              <div className="alias-input">
                <span className="prefix">{prefix}</span>
                <input type="text" placeholder="your-alias-suffix" required />
                <span className="domain">@{domain}</span>
              </div>
              <button type="submit" className="add-button">Add Alias</button>
            </form>
          </div>

          <div className="back">
            <a href="/student-portal">← Back to Portal</a>
          </div>
        </div>
      </div>

      <style jsx>{`
        .container {
          display: flex;
          justify-content: center;
          padding: 40px 20px;
          background: #f5f7fa;
          min-height: 100vh;
        }
        .card {
          background: #fff;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.1);
          max-width: 600px;
          width: 100%;
          text-align: center;
        }
        .header {
          margin-bottom: 30px;
        }
        .logo {
          height: 60px;
          margin-bottom: 10px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          color: #333;
        }
        .header h2 {
          margin-top: 8px;
          font-size: 18px;
          color: #555;
        }
        .email-section, .aliases-section, .add-alias-section {
          margin-bottom: 30px;
        }
        .alias-input {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          margin-top: 10px;
        }
        .alias-input input {
          padding: 8px;
          font-size: 16px;
          width: 50%;
          border: 1px solid #ccc;
          border-radius: 6px;
        }
        .prefix, .domain {
          font-size: 16px;
          color: #333;
        }
        .add-button {
          margin-top: 15px;
          padding: 10px 20px;
          background: #28a745;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
        }
        .add-button:hover {
          background: #218838;
        }
        .back {
          margin-top: 20px;
        }
        .back a {
          color: #0070f3;
          text-decoration: none;
        }
      `}</style>
    </>
  )
}
