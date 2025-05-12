"use client"

import Head from "next/head"
import { parse } from "cookie"
import { useEffect, useState } from "react"

// --- getServerSideProps (简化版) ---
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

// 极简版成绩单组件
export default function Transcript({ fullName, studentEmail, studentId, error }) {
  const [printDate, setPrintDate] = useState("")

  useEffect(() => {
    // 设置打印日期
    setPrintDate(
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    )
  }, [])

  // 错误处理
  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "red", fontFamily: "Arial, sans-serif" }}>
        <h2>Error Loading Transcript</h2>
        <p>{error}</p>
        <a href="/student-portal" style={{ color: "#007bff", textDecoration: "underline", marginRight: "15px" }}>
          Back to Portal
        </a>
      </div>
    )
  }

  // 固定数据
  const displaySid = studentId ? String(studentId).padStart(6, "0") : "N/A"
  const dateOfBirth = "January 15, 1998"
  const gpa = "3.45"
  const academicStanding = "Good Standing"
  const totalAttempted = 14.0
  const totalEarned = 14.0
  const totalQualityPoints = 48.3
  const currentTerm = "Spring 2025"
  const transcriptNo = `CI-TR-20250512-${displaySid.substring(0, 2)}`
  const verificationCode = `CI250512-${displaySid.substring(0, 6)}-TR`

  // 固定课程数据
  const courses = [
    { id: "CHN101", title: "Elementary Chinese Speaking", credits: 3.0, grade: "A" },
    { id: "CHN102", title: "Elementary Chinese Reading", credits: 3.0, grade: "B+" },
    { id: "CHN201", title: "Intermediate Chinese Listening", credits: 3.0, grade: "A-" },
    { id: "CUL100", title: "Chinese Culture and Society", credits: 3.0, grade: "B" },
    { id: "CUL120", title: "Chinese Calligraphy", credits: 2.0, grade: "B-" },
  ]

  // 固定学位进度数据
  const degreeProgress = [
    {
      name: "Chinese Language Core",
      required: "60.00",
      completed: "6.00",
      inProgress: "3.00",
      remaining: "51.00",
      status: "In Progress (10%)",
    },
    {
      name: "Culture & History",
      required: "45.00",
      completed: "5.00",
      inProgress: "0.00",
      remaining: "40.00",
      status: "In Progress (11%)",
    },
    {
      name: "General Studies",
      required: "30.00",
      completed: "3.00",
      inProgress: "0.00",
      remaining: "27.00",
      status: "In Progress (10%)",
    },
    {
      name: "Electives",
      required: "15.00",
      completed: "0.00",
      inProgress: "0.00",
      remaining: "15.00",
      status: "Not Started (0%)",
    },
    {
      name: "Total Program Requirements",
      required: "150.00",
      completed: "14.00",
      inProgress: "3.00",
      remaining: "133.00",
      status: "In Progress (9%)",
    },
  ]

  return (
    <>
      <Head>
        <title>Academic Transcript - Confucius Institute</title>
        <meta name="description" content="Confucius Institute Official Academic Transcript" />
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

      <div className="transcript">
        <div className="header">
          <div className="logo-container">
            <img
              src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png"
              alt="Confucius Institute Logo"
              className="logo"
            />
            <div className="institute-name">
              <h2>CONFUCIUS INSTITUTE</h2>
              <p>at Kyrgyz National University</p>
            </div>
          </div>
          <h1 className="title">OFFICIAL ACADEMIC TRANSCRIPT</h1>
          <p className="print-date">Print Date: {printDate}</p>

          <div className="verification-section">
            <p>Document ID: {transcriptNo}</p>
            <p>
              Verification Code: <span className="verification-code">{verificationCode}</span>
            </p>
            <p>Verify at: kzxy.edu.kg</p>
          </div>
        </div>

        <div className="section">
          <div className="section-title">STUDENT INFORMATION</div>
          <table className="student-info">
            <tbody>
              <tr>
                <td>
                  <strong>Full Name</strong>
                </td>
                <td>{fullName || "N/A"}</td>
                <td>
                  <strong>Student ID</strong>
                </td>
                <td>{displaySid}</td>
              </tr>
              <tr>
                <td>
                  <strong>Date of Birth</strong>
                </td>
                <td>{dateOfBirth}</td>
                <td>
                  <strong>Email</strong>
                </td>
                <td>{studentEmail || "N/A"}</td>
              </tr>
              <tr>
                <td>
                  <strong>Program</strong>
                </td>
                <td colSpan="3">Chinese Language Studies</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="section">
          <div className="section-title">ACADEMIC SUMMARY</div>
          <table>
            <tbody>
              <tr>
                <td>
                  <strong>Institutional GPA</strong>
                </td>
                <td>{gpa}</td>
                <td>
                  <strong>Total Credits Attempted</strong>
                </td>
                <td>{totalAttempted.toFixed(1)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Academic Standing</strong>
                </td>
                <td>{academicStanding}</td>
                <td>
                  <strong>Total Credits Earned</strong>
                </td>
                <td>{totalEarned.toFixed(1)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Total Quality Points</strong>
                </td>
                <td>{totalQualityPoints.toFixed(1)}</td>
                <td>
                  <strong>Current Semester</strong>
                </td>
                <td>{currentTerm}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="section">
          <div className="section-title">CONFUCIUS INSTITUTE AT KYRGYZ NATIONAL UNIVERSITY</div>

          <div>
            <div className="term-title">{currentTerm}</div>
            <table>
              <thead>
                <tr>
                  <th>Course ID</th>
                  <th>Course Title</th>
                  <th>Grade</th>
                  <th>Credits</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course, index) => (
                  <tr key={index}>
                    <td>{course.id}</td>
                    <td>{course.title}</td>
                    <td>{course.grade}</td>
                    <td>{course.credits.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="term-summary">
              Term Credits: {courses.reduce((sum, course) => sum + course.credits, 0).toFixed(1)}
            </p>
          </div>
        </div>

        <div className="section">
          <div className="section-title">DEGREE PROGRESS</div>
          <table>
            <thead>
              <tr>
                <th>Requirement</th>
                <th>Required</th>
                <th>Completed</th>
                <th>In Progress</th>
                <th>Remaining</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {degreeProgress.map((req, index) => (
                <tr key={index}>
                  <td>{req.name}</td>
                  <td>{req.required}</td>
                  <td>{req.completed}</td>
                  <td>{req.inProgress}</td>
                  <td>{req.remaining}</td>
                  <td>{req.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section">
          <div className="section-title">GRADING SYSTEM</div>
          <table className="grading-system">
            <thead>
              <tr>
                <th>Grade</th>
                <th>Quality Points</th>
                <th>Grade</th>
                <th>Quality Points</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>A</td>
                <td>4.0</td>
                <td>C+</td>
                <td>2.3</td>
              </tr>
              <tr>
                <td>A-</td>
                <td>3.7</td>
                <td>C</td>
                <td>2.0</td>
              </tr>
              <tr>
                <td>B+</td>
                <td>3.3</td>
                <td>C-</td>
                <td>1.7</td>
              </tr>
              <tr>
                <td>B</td>
                <td>3.0</td>
                <td>D+</td>
                <td>1.3</td>
              </tr>
              <tr>
                <td>B-</td>
                <td>2.7</td>
                <td>D</td>
                <td>1.0</td>
              </tr>
              <tr>
                <td colSpan="2"></td>
                <td>W</td>
                <td>Withdrawal (No point value)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="signatures">
          <div className="signature">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/registrar_signature.png-jGPP68ItD24zryNlBDleit1S1QORmp.jpeg"
              alt="Registrar Signature"
              className="signature-img"
            />
            <p className="title">University Registrar</p>
          </div>
          <div className="signature">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/registrar_signature.png-jGPP68ItD24zryNlBDleit1S1QORmp.jpeg"
              alt="Dean Signature"
              className="signature-img"
            />
            <p className="title">Dean of Academic Affairs</p>
          </div>
        </div>

        <div className="barcode-container">
          <p className="barcode-placeholder">Student ID: {displaySid}</p>
        </div>

        <div className="footer">
          <p>This is an official academic transcript issued by Confucius Institute at Kyrgyz National University.</p>
          <p>
            Document ID: {transcriptNo} • Generated: {printDate}
          </p>
          <p>To verify the authenticity of this document, please visit kzxy.edu.kg</p>
        </div>
      </div>

      <style jsx>{`
        body {
          margin: 0;
          padding: 20px;
          background: #f5f5f5;
          font-family: 'Montserrat', Arial, sans-serif;
          color: #333;
          line-height: 1.4;
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
        
        .transcript {
          max-width: 800px;
          margin: 0 auto;
          background: #fff;
          padding: 30px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #006633;
          padding-bottom: 20px;
          position: relative;
        }
        
        .logo-container {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 15px;
        }
        
        .logo {
          height: 80px;
          width: auto;
          margin-right: 15px;
          background-color: white;
          padding: 5px;
          border-radius: 5px;
        }
        
        .institute-name {
          text-align: left;
        }
        
        .institute-name h2 {
          margin: 0;
          color: #006633;
          font-size: 24px;
          font-weight: bold;
        }
        
        .institute-name p {
          margin: 5px 0 0;
          color: #333;
          font-size: 16px;
        }
        
        .title {
          color: #006633;
          margin: 10px 0;
          font-size: 24px;
          font-weight: bold;
        }
        
        .print-date {
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
        
        .section {
          margin: 20px 0;
        }
        
        .section-title {
          background: #006633;
          color: #fff;
          padding: 8px 15px;
          margin-bottom: 15px;
          font-weight: bold;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }
        
        th, td {
          padding: 8px;
          border: 1px solid #ddd;
          font-size: 0.9em;
        }
        
        th {
          background: #006633;
          color: #fff;
          font-weight: bold;
        }
        
        .student-info td {
          width: 25%;
        }
        
        .term-title {
          background: #FFC72C;
          color: #000;
          padding: 8px 15px;
          margin: 20px 0 10px;
          font-weight: bold;
        }
        
        .term-summary {
          text-align: right;
          font-weight: bold;
          margin: 10px 0;
          color: #006633;
        }
        
        .signatures {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #006633;
          display: flex;
          justify-content: space-between;
        }
        
        .signature {
          text-align: center;
          width: 45%;
        }
        
        .signature-img {
          max-width: 150px;
          height: auto;
          margin-bottom: 5px;
        }
        
        .signature p {
          color: #006633;
          font-weight: bold;
          margin: 5px 0;
        }
        
        .signature p.title {
          font-weight: normal;
          font-size: 14px;
          color: #333;
        }
        
        .barcode-container {
          text-align: center;
          margin: 30px 0;
        }
        
        .barcode-placeholder {
          color: #333;
          font-size: 16px;
          margin-top: 5px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: monospace;
          border: 1px dashed #ccc;
          background: #f9f9f9;
        }
        
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #006633;
          text-align: center;
          color: #666;
        }
        
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        
        tr:hover {
          background-color: #f5f5f5;
        }
        
        .grading-system {
          width: 100%;
        }
        
        .grading-system td, .grading-system th {
          width: 25%;
          text-align: center;
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
          
          .transcript {
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
          .transcript {
            padding: 15px;
          }
          
          .logo-container {
            flex-direction: column;
            text-align: center;
          }
          
          .logo {
            margin-right: 0;
            margin-bottom: 10px;
          }
          
          .institute-name {
            text-align: center;
          }
          
          .student-info td {
            display: block;
            width: 100%;
          }
          
          .student-info tr {
            display: block;
            margin-bottom: 10px;
          }
          
          .signatures {
            flex-direction: column;
            align-items: center;
          }
          
          .signature {
            width: 80%;
            margin-bottom: 20px;
          }
        }
      `}</style>
    </>
  )
}
