import Head from 'next/head'
import { parse } from 'cookie'

export async function getServerSideProps({ req }) {
  const cookies = parse(req.headers.cookie || '')
  const oauthUsername = cookies.oauthUsername
  const oauthFullName = cookies.oauthFullName || oauthUsername
  const oauthUserId = cookies.oauthUserId
  const oauthTrustLevel = parseInt(cookies.oauthTrustLevel || '0', 10)

  if (!oauthUsername || oauthTrustLevel < 3) {
    return { redirect: { destination: '/forbidden', permanent: false } }
  }

  return {
    props: {
      fullName: oauthFullName,
      studentId: oauthUserId
    }
  }
}

export default function StudentCard({ fullName, studentId }) {
  const sid = String(studentId).padStart(6, '0')

  return (
    <>
      <Head>
        <title>Student Card - Confucius Institute</title>
      </Head>

      <div className="container">
        <div className="card">
          <h1>Confucius Institute</h1>
          <h2>Student ID Card</h2>

          <div className="info">
            <p><strong>Name:</strong> {fullName}</p>
            <p><strong>Student ID:</strong> {sid}</p>
          </div>

          <a href="/student-portal" className="back-button">← Back to Portal</a>
        </div>
      </div>

      <style jsx>{`
        .container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: #f0f2f5;
          padding: 20px;
        }
        .card {
          background: #fff;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
          width: 100%;
        }
        h1 {
          margin-bottom: 10px;
        }
        h2 {
          margin-bottom: 20px;
          font-size: 18px;
          color: #555;
        }
        .info p {
          margin: 8px 0;
        }
        .back-button {
          margin-top: 30px;
          display: inline-block;
          padding: 10px 20px;
          background: #0070f3;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-size: 16px;
        }
        .back-button:hover {
          background: #005bb5;
        }
      `}</style>
    </>
  )
}
