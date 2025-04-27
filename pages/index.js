import Head from 'next/head'

export default function Home() {
  return (
    <>
      <Head>
        <title>Welcome - Confucius Institute</title>
      </Head>

      <div className="container">
        <div className="card">
          <h1>Welcome to Confucius Institute</h1>
          <p>Please authenticate via Google to continue:</p>
          <a href="/api/oauth2/initiate" className="login-button">
            Sign in with Google
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
        }
        .card {
          background: #fff;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.1);
          text-align: center;
        }
        h1 {
          margin-bottom: 20px;
        }
        .login-button {
          margin-top: 20px;
          display: inline-block;
          padding: 10px 20px;
          background: #0070f3;
          color: #fff;
          border-radius: 6px;
          text-decoration: none;
          font-size: 16px;
        }
        .login-button:hover {
          background: #005bb5;
        }
      `}</style>
    </>
  )
}
