import Head from 'next/head'

export default function Forbidden() {
  return (
    <>
      <Head>
        <title>Access Denied - Confucius Institute</title>
      </Head>

      <div className="container">
        <div className="card">
          <h1>Access Denied</h1>
          <p>Sorry, this portal is only for students with a <strong>@kzxy.edu.kg</strong> email address.</p>

          <button onClick={() => window.location.href = '/'} className="back-button">
            Back to Home
          </button>
        </div>
      </div>

      <style jsx>{`
        .container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8f9fa;
          padding: 20px;
        }
        .card {
          background: #fff;
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
        }
        h1 {
          margin-bottom: 20px;
          color: #dc3545;
        }
        p {
          margin-bottom: 30px;
          color: #555;
          font-size: 16px;
        }
        .back-button {
          padding: 10px 20px;
          background: #0070f3;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
        }
        .back-button:hover {
          background: #005bb5;
        }
      `}</style>
    </>
  )
}
