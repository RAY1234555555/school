"use client"

import Head from "next/head"
import { parse } from "cookie"
import { useEffect, useState } from "react"

// --- getServerSideProps (与成绩单页面类似) ---
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

// 录取通知书组件
export default function AdmissionLetter({ fullName, studentEmail, studentId, error }) {
  const [currentDate, setCurrentDate] = useState("")
  const [documentId, setDocumentId] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [generatedTime, setGeneratedTime] = useState("")

  useEffect(() => {
    // 设置当前日期
    const now = new Date()
    setCurrentDate(
      now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    )

    // 生成文档ID和验证码
    const displaySid = studentId ? String(studentId).padStart(6, "0") : "000000"
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
    setDocumentId(`CI-AD-${dateStr}`)
    setVerificationCode(`CI${dateStr.substring(2)}-${displaySid}-AD`)

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
        }),
    )
  }, [studentId])

  // 错误处理
  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "red", fontFamily: "Arial, sans-serif" }}>
        <h2>Error Loading Admission Letter</h2>
        <p>{error}</p>
        <a href="/student-portal" style={{ color: "#007bff", textDecoration: "underline", marginRight: "15px" }}>
          Back to Portal
        </a>
      </div>
    )
  }

  // 从全名中提取姓氏和名字
  const nameParts = fullName.split(" ")
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : fullName
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : ""
  const title = lastName ? (lastName.endsWith("a") ? "Ms." : "Mr.") : "Student"

  // 生成ASURITE ID (类似于ASU的示例)
  const asurite = studentEmail ? studentEmail.split("@")[0] : "student"

  // 固定地址 (示例)
  const address = {
    street: "164 Bishkek Avenue",
    city: "Bishkek",
    region: "Chuy",
    postal: "720001",
    country: "Kyrgyzstan",
  }

  // 开学日期
  const startDate = "September 1, 2025"

  // 学生ID
  const displaySid = studentId ? String(studentId).padStart(6, "0") : "000000"

  return (
    <>
      <Head>
        <title>Admission Letter - Confucius Institute</title>
        <meta name="description" content="Confucius Institute Official Admission Letter" />
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

      <div className="letter">
        <div className="header">
          <img
            src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png"
            alt="Confucius Institute Logo"
            className="logo"
          />
          <h1 className="title">OFFICIAL ADMISSION LETTER</h1>
        </div>

        <div className="date">{currentDate}</div>

        <div className="address">
          <p>{fullName}</p>
          <p>{address.street}</p>
          <p>
            {address.city}, {address.region} {address.postal}
          </p>
          <p>{address.country}</p>
        </div>

        <div className="content">
          <p>
            Dear {title} {lastName},
          </p>

          <p>
            On behalf of the Confucius Institute at Kyrgyz National University, I am pleased to offer you admission to
            the Chinese Language and Culture Studies Program for the Fall 2025 semester.
          </p>

          <p>
            Your application demonstrated exceptional interest in Chinese language and culture, as well as the academic
            potential that aligns with our institute's mission of promoting Chinese language education and cultural
            exchange. We believe you will make valuable contributions to our academic community.
          </p>

          <p>
            <strong>Admission Details:</strong>
          </p>
          <ul>
            <li>Program: Chinese Language and Culture Studies</li>
            <li>Institute: Confucius Institute at Kyrgyz National University</li>
            <li>Start Date: {startDate}</li>
            <li>Student ID: {displaySid}</li>
            <li>Email ID: {asurite}</li>
          </ul>

          <p>To secure your place in the program, please complete the following steps by July 15, 2025:</p>
          <ol>
            <li>Submit your enrollment confirmation</li>
            <li>Complete the online orientation</li>
            <li>Submit your final academic transcripts</li>
            <li>Complete the accommodation application (if applicable)</li>
          </ol>

          <p>
            You can access your Student Portal using your email credentials to complete these requirements and view
            additional information about your admission.
          </p>

          <p>
            We are excited to welcome you to the Confucius Institute family and look forward to supporting your journey
            in Chinese language and cultural studies.
          </p>

          <p>Sincerely,</p>
        </div>

        <div className="signature">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/registrar_signature.png-jGPP68ItD24zryNlBDleit1S1QORmp.jpeg"
            alt="Director Signature"
            className="signature-img"
          />
          <p>Dr. Li Wei</p>
          <p>Director</p>
          <p>Confucius Institute at Kyrgyz National University</p>
        </div>

        <div className="verification-section">
          <p>Document ID: {documentId}</p>
          <p>
            Verification Code: <span className="verification-code">{verificationCode}</span>
          </p>
          <p>Verify at: kzxy.edu.kg</p>
        </div>

        <div className="footer">
          <p>This is an official admission letter issued by Confucius Institute at Kyrgyz National University.</p>
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
        
        .letter {
          max-width: 800px;
          margin: 0 auto;
          background: #fff;
          padding: 40px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #006633;
          padding-bottom: 20px;
        }
        
        .header .logo {
          max-width: 300px;
          margin-bottom: 20px;
        }
        
        .title {
          color: #006633;
          margin: 10px 0;
          font-size: 24px;
          font-weight: bold;
        }
        
        .date {
          text-align: right;
          margin-bottom: 30px;
          color: #666;
        }
        
        .address {
          margin-bottom: 30px;
        }
        
        .content {
          margin-bottom: 30px;
        }
        
        .content p {
          margin-bottom: 15px;
        }
        
        .signature {
          margin-top: 50px;
          text-align: right;
        }
        
        .signature-img {
          max-width: 200px;
          margin-bottom: 10px;
        }
        
        .signature p {
          color: #006633;
          font-weight: bold;
          margin: 0;
          line-height: 1.4;
        }
        
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #006633;
          text-align: center;
          color: #666;
          font-size: 0.9em;
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
          
          .letter {
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
          .letter {
            padding: 20px;
          }
          
          .header .logo {
            max-width: 200px;
          }
          
          .title {
            font-size: 20px;
          }
          
          .signature-img {
            max-width: 150px;
          }
        }
      `}</style>
    </>
  )
}
