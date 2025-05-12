"use client"

import Head from "next/head"
import { parse } from "cookie"
import { useEffect, useState } from "react"

// --- getServerSideProps (与其他页面类似) ---
export async function getServerSideProps({ req }) {
  try {
    console.log("[getServerSideProps] 开始加载...")
    const cookies = parse(req.headers.cookie || "")
    const oauthUsername = cookies.oauthUsername || null
    const studentIdFromCookie = cookies.oauthStudentId || cookies.oauthUserId || null
    const oauthFullNameFromCookie = cookies.oauthFullName || null
    const trustLevel = Number.parseInt(cookies.oauthTrustLevel || "0", 10)

    if (!oauthUsername || trustLevel < 3) {
      console.log("[getServerSideProps] 权限不足，重定向到登录页")
      return { redirect: { destination: "/", permanent: false } }
    }

    const rawDom = process.env.EMAIL_DOMAIN
    const domain = rawDom && rawDom.startsWith("@") ? rawDom : "@" + (rawDom || "kzxy.edu.kg")
    const studentEmail = oauthUsername.includes("@") ? oauthUsername : `${oauthUsername}${domain}`

    return {
      props: {
        fullName: oauthFullNameFromCookie || "Student",
        studentEmail,
        studentId: studentIdFromCookie || "123456",
        error: null,
      },
    }
  } catch (error) {
    console.error("[getServerSideProps] 错误:", error)
    return { props: { error: "加载数据时出错。请稍后再试。" } }
  }
}

// 学费单组件
export default function TuitionReceipt({ fullName, studentEmail, studentId, error }) {
  const [currentDate, setCurrentDate] = useState("")
  const [documentId, setDocumentId] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [generatedTime, setGeneratedTime] = useState("")
  const [paymentDate, setPaymentDate] = useState("")
  const [transactionId, setTransactionId] = useState("")

  useEffect(() => {
    // 设置当前日期
    const now = new Date()
    setCurrentDate(
      now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    )

    // 生成文档ID和验证码
    const displaySid = studentId ? String(studentId).padStart(6, "0") : "000000"
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
    setDocumentId(`CI-TR-${dateStr}`)
    setVerificationCode(`CI${dateStr.substring(2)}-${displaySid}-TR`)

    // 生成时间
    setGeneratedTime(
      now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }) +
        " " +
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
    )

    // 设置支付日期（假设是前一天）
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    setPaymentDate(
      yesterday.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    )

    // 生成交易ID
    setTransactionId(`CI-CC-${dateStr}01`)
  }, [studentId])

  // 错误处理
  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "red", fontFamily: "Arial, sans-serif" }}>
        <h2>Error Loading Tuition Receipt</h2>
        <p>{error}</p>
        <a href="/student-portal" style={{ color: "#007bff", textDecoration: "underline", marginRight: "15px" }}>
          Back to Portal
        </a>
      </div>
    )
  }

  // 学生ID
  const displaySid = studentId ? String(studentId).padStart(6, "0") : "000000"
  
  // 从电子邮件中提取用户名
  const username = studentEmail ? studentEmail.split("@")[0] : "student"

  return (
    <>
      <Head>
        <title>Tuition Receipt - Confucius Institute</title>
        <meta name="description" content="Confucius Institute Official Tuition Receipt" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="watermark">CONFUCIUS INSTITUTE</div>

      <div className="pdf-button-container">
        <button className="pdf-button" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <div className="receipt">
        <div className="header">
          <div className="header-left">
            <div className="seal">
              <div className="seal-inner"></div>
            </div>
          </div>
          <div className="header-right">
            <img
              src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png"
              alt="Confucius Institute Logo"
              className="logo"
            />
            <h1 className="title">学费缴纳收据</h1>
            <h2 className="subtitle">TUITION PAYMENT RECEIPT</h2>
          </div>
        </div>

        <div className="date">
          {currentDate}
        </div>

        <div className="student-info">
          <div className="info-row">
            <div className="info-label">Student Name:</div>
            <div className="info-value">{fullName}</div>
          </div>
          <div className="info-row">
            <div className="info-label">Student ID:</div>
            <div className="info-value">{displaySid}</div>
          </div>
          <div className="info-row">
            <div className="info-label">Email ID:</div>
            <div className="info-value">{studentEmail}</div>
          </div>
          <div className="info-row">
            <div className="info-label">Program:</div>
            <div className="info-value">Chinese Language and Culture Studies</div>
          </div>
          <div className="info-row">
            <div className="info-label">Term:</div>
            <div className="info-value">Fall 2025</div>
          </div>
        </div>

        <div className="payment-details">
          <h2>Payment Details</h2>
          <table className="payment-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tuition (12 credits)</td>
                <td>¥8,800.00</td>
              </tr>
              <tr>
                <td>Student Services Fee</td>
                <td>¥150.00</td>
              </tr>
              <tr>
                <td>Technology Fee</td>
                <td>¥100.00</td>
              </tr>
              <tr>
                <td>Health Services Fee</td>
                <td>¥75.00</td>
              </tr>
              <tr>
                <td>Cultural Activities Fee</td>
                <td>¥50.00</td>
              </tr>
              <tr>
                <td>International Student Fee</td>
                <td>¥50.00</td>
              </tr>
            </tbody>
          </table>
          <div className="total">
            Total Amount: ¥9,225.00
          </div>
        </div>

        <div className="payment-details">
          <h2>Payment Information</h2>
          <div className="payment-status">PAYMENT CONFIRMED</div>
          <table className="payment-table">
            <thead>
              <tr>
                <th>Payment Method</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Transaction ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Credit Card</td>
                <td>¥9,225.00</td>
                <td>{paymentDate}</td>
                <td>{transactionId}</td>
                <td>Completed</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="signature-section">
          <div className="signature">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/registrar_signature.png-jGPP68ItD24zryNlBDleit1S1QORmp.jpeg"
              alt="Registrar Signature"
              className="signature-img"
            />
            <p>University Registrar</p>
          </div>
          <div className="signature">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/registrar_signature.png-jGPP68ItD24zryNlBDleit1S1QORmp.jpeg"
              alt="Dean Signature"
              className="signature-img"
            />
            <p>Dean of Academic Affairs</p>
          </div>
        </div>

        <div className="signature-section">
          <div className="signature" style={{ width: "100%" }}>
            <div className="seal-large">
              <div className="seal-inner-large"></div>
            </div>
            <p>Official Seal of Confucius Institute at Kyrgyz National University</p>
          </div>
        </div>

        <div className="verification-section">
          <p>Document ID: {documentId}</p>
          <p>
            Verification Code: <span className="verification-code">{verificationCode}</span>
          </p>
          <p>Verify at: kzxy.edu.kg</p>
        </div>

        <div className="footer">
          <p>This is an official tuition payment receipt issued by Confucius Institute at Kyrgyz National University.</p>
          <p>
            Document ID: {documentId} • Generated: {generatedTime}
          </p>
          <p>To verify the authenticity of this document, please visit kzxy.edu.kg</p>
        </div>
      </div>

      <style jsx>{`
        body {
          margin: 0;
          padding: 20px;
          background: #f5f5f5;
          font-family: 'Montserrat', sans-serif;
          color: #333;
          line-height: 1.6;
        }
        
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 120px;
          color: rgba(0, 102, 51, 0.03);
          pointer-events: none;
          white-space: nowrap;
          z-index: 1000;
        }
        
        .receipt {
          max-width: 800px;
          margin: 0 auto;
          background: #fff;
          padding: 40px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .header {
          text-align: left;
          margin-bottom: 30px;
          border-bottom: 3px solid #006633;
          padding-bottom: 20px;
          display: flex;
          align-items: center;
          position: relative;
        }
        
        .header-left {
          width: 120px;
          margin-right: 20px;
        }
        
        .seal {
          width: 120px;
          height: 120px;
          border: 3px solid #006633;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        
        .seal::before {
          content: 'CONFUCIUS INSTITUTE';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(0deg);
          font-size: 8px;
          font-weight: bold;
          color: #006633;
          text-align: center;
          width: 100px;
        }
        
        .seal::after {
          content: '';
          position: absolute;
          width: 80px;
          height: 80px;
          border: 2px solid #006633;
          border-radius: 50%;
        }
        
        .seal-inner {
          width: 40px;
          height: 40px;
          background: #006633;
          border-radius: 50%;
          position: relative;
        }
        
        .seal-inner::before {
          content: 'CI';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 12px;
          font-weight: bold;
        }
        
        .seal-large {
          width: 150px;
          height: 150px;
          border: 3px solid #006633;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin: 0 auto;
        }
        
        .seal-large::before {
          content: 'CONFUCIUS INSTITUTE AT KYRGYZ NATIONAL UNIVERSITY';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(0deg);
          font-size: 8px;
          font-weight: bold;
          color: #006633;
          text-align: center;
          width: 120px;
        }
        
        .seal-large::after {
          content: '';
          position: absolute;
          width: 100px;
          height: 100px;
          border: 2px solid #006633;
          border-radius: 50%;
        }
        
        .seal-inner-large {
          width: 50px;
          height: 50px;
          background: #006633;
          border-radius: 50%;
          position: relative;
        }
        
        .seal-inner-large::before {
          content: 'CI';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 16px;
          font-weight: bold;
        }
        
        .header-right {
          flex: 1;
        }
        
        .header-right .logo {
          max-width: 300px;
          margin-bottom: 15px;
        }
        
        .title {
          color: #006633;
          margin: 10px 0 5px;
          font-size: 28px;
          font-weight: bold;
          letter-spacing: 0.5px;
        }
        
        .subtitle {
          color: #006633;
          margin: 0;
          font-size: 18px;
          font-weight: normal;
        }
        
        .date {
          text-align: right;
          margin-bottom: 30px;
          color: #666;
        }
        
        .student-info {
          margin-bottom: 30px;
        }
        
        .info-row {
          display: flex;
          margin-bottom: 10px;
        }
        
        .info-label {
          width: 150px;
          font-weight: bold;
          color: #666;
        }
        
        .info-value {
          flex: 1;
        }
        
        .payment-details {
          margin: 30px 0;
        }
        
        .payment-details h2 {
          color: #006633;
          border-bottom: 1px solid #ddd;
          padding-bottom: 10px;
        }
        
        .payment-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        
        .payment-table th,
        .payment-table td {
          padding: 12px;
          border: 1px solid #ddd;
          text-align: left;
        }
        
        .payment-table th {
          background: #006633;
          color: white;
        }
        
        .payment-table tr:nth-child(even) {
          background: #f9f9f9;
        }
        
        .total {
          text-align: right;
          font-weight: bold;
          margin-top: 20px;
          font-size: 18px;
        }
        
        .payment-status {
          text-align: center;
          padding: 10px;
          background: #4CAF50;
          color: white;
          font-weight: bold;
          border-radius: 4px;
          margin: 20px 0;
        }
        
        .signature-section {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #006633;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .signature {
          text-align: center;
          width: 45%;
        }
        
        .signature-img {
          max-width: 200px;
          margin-bottom: 10px;
        }
        
        .signature p {
          color: #006633;
          font-weight: bold;
          margin: 5px 0;
        }
        
        .verification-section {
          text-align: center;
          margin-top: 20px;
          padding: 15px;
          background: #f8f8f8;
          border-radius: 8px;
        }
        
        .verification-code {
          font-family: monospace;
          background: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid #ddd;
        }
        
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #006633;
          text-align: center;
          color: #666;
          font-size: 0.9em;
        }
        
        .pdf-button-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1001;
        }

        .pdf-button {
          background-color: #006633;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 15px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pdf-button:hover {
          background-color: #005528;
        }

        .pdf-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        @media print {
          body {
            background-color: #fff;
            padding: 0;
            margin: 0;
          }
          
          .receipt {
            box-shadow: none;
            margin: 0;
            max-width: 100%;
            padding: 20px;
            border: none;
          }
          
          .watermark {
            color: rgba(0, 102, 51, 0.03) !important;
          }
          
          .pdf-button-container {
            display: none;
          }
        }
        
        @media (max-width: 768px) {
          .receipt {
            padding: 20px;
          }
          
          .header {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          
          .header-left {
            margin-right: 0;
            margin-bottom: 20px;
          }
          
          .info-row {
            flex-direction: column;
          }
          
          .info-label {
            width: 100%;
            margin-bottom: 5px;
          }
          
          .signature-section {
            flex-direction: column;
          }
          
          .signature {
            width: 100%;
            margin-bottom: 20px;
          }
        }
      `}</style>
    </>
  )
}
