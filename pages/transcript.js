"use client"

import Head from "next/head"
import Script from "next/script"
import { useEffect, useState, useCallback } from "react"
import { parse } from "cookie"
import { DateTime } from "luxon"

// --- fetchGoogleUser Helper (Remains the same) ---
async function fetchGoogleUser(email) {
  console.log(`[fetchGoogleUser - Transcript] Attempting for: ${email}`)
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    console.error("[fetchGoogleUser - Transcript] Missing Google OAuth ENV VARS!")
    return null
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    })
    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text()
      console.error(`[fetchGoogleUser - Transcript] Token Refresh Fail: ${tokenRes.status}`, errorBody)
      return null
    }
    const { access_token } = await tokenRes.json()
    console.log(`[fetchGoogleUser - Transcript] Token OK. Fetching user...`)
    const userRes = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?projection=full`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    )
    if (!userRes.ok) {
      const errorBody = await userRes.text()
      console.error(`[fetchGoogleUser - Transcript] User Fetch Fail: ${userRes.status}`, errorBody)
      return null
    }
    console.log(`[fetchGoogleUser - Transcript] User OK.`)
    return await userRes.json()
  } catch (error) {
    console.error("[fetchGoogleUser - Transcript] Network/Other Error:", error)
    return null
  }
}

// --- getServerSideProps (Remains the same) ---
export async function getServerSideProps({ req }) {
  console.log("[getServerSideProps - Transcript] Starting...")
  const cookies = parse(req.headers.cookie || "")
  const oauthUsername = cookies.oauthUsername || null
  const studentIdFromCookie = cookies.oauthStudentId || cookies.oauthUserId || null
  const oauthFullNameFromCookie = cookies.oauthFullName || null
  const trustLevel = Number.parseInt(cookies.oauthTrustLevel || "0", 10)

  console.log("[getServerSideProps - Transcript] Cookies:", cookies)

  if (!oauthUsername || trustLevel < 3) {
    console.log("[getServerSideProps - Transcript] Redirect: Auth Fail.")
    return { redirect: { destination: "/", permanent: false } }
  }

  const rawDom = process.env.EMAIL_DOMAIN
  const domain = rawDom && rawDom.startsWith("@") ? rawDom : "@" + (rawDom || "kzxy.edu.kg")
  const studentEmail = oauthUsername.includes("@") ? oauthUsername : `${oauthUsername}${domain}`

  console.log("[getServerSideProps - Transcript] Fetching Google User:", studentEmail)
  const googleUser = await fetchGoogleUser(studentEmail)

  let fullName,
    emailToUse,
    finalStudentId,
    fetchError = null

  if (!googleUser) {
    console.warn("[getServerSideProps - Transcript] Fetch Fail. Fallback.")
    fetchError = "Could not refresh data from Google."
    fullName = oauthFullNameFromCookie
    emailToUse = studentEmail
    finalStudentId = studentIdFromCookie
  } else {
    console.log("[getServerSideProps - Transcript] Fetch OK.")
    fullName = googleUser.name
      ? `${googleUser.name.givenName || ""} ${googleUser.name.familyName || ""}`.trim()
      : oauthFullNameFromCookie
    emailToUse = googleUser.primaryEmail || studentEmail
    finalStudentId = studentIdFromCookie || googleUser.id
  }

  if (!finalStudentId) {
    console.error("[getServerSideProps - Transcript] Error: ID Missing.")
    return { props: { error: "Student ID missing." } }
  }
  if (!fullName) {
    fullName = "Student"
  }

  console.log("[getServerSideProps - Transcript] Props Data:", { fullName, emailToUse, finalStudentId })

  return { props: { fullName, studentEmail: emailToUse, studentId: finalStudentId, error: null, fetchError } }
}

// --- Redesigned Transcript Component based on ASU template ---
export default function Transcript({ fullName, studentEmail, studentId, error, fetchError }) {
  // State for transcript data
  const [coursesData, setCoursesData] = useState({
    selectedCourses: [],
    totalAttempted: 0,
    totalEarned: 0,
    totalQualityPoints: 0,
    gpa: "0.00",
  })
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [printDate, setPrintDate] = useState("")
  const [transcriptNo, setTranscriptNo] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [academicStanding, setAcademicStanding] = useState("Good Standing")

  // Helpers remain the same
  const seededRandom = useCallback((seed) => {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }, [])

  const generateRandomDOB = useCallback(
    (seed) => {
      const random = (offset) => seededRandom(seed + offset)
      const baseYear = 1998 + Math.floor(random(50) * 8)
      const m = Math.floor(random(51) * 12)
      const d = 1 + Math.floor(random(52) * 27)
      const dob = new Date(baseYear, m, d)
      return dob.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    },
    [seededRandom],
  )

  const generateCoursesData = useCallback(
    (studentIdSeed) => {
      const coursePool = [
        { id: "CHN101", title: "Elementary Chinese Speaking", credits: 3.0 },
        { id: "CHN102", title: "Elementary Chinese Reading", credits: 3.0 },
        { id: "CHN201", title: "Intermediate Chinese Speaking", credits: 3.0 },
        { id: "CHN202", title: "Intermediate Chinese Reading", credits: 3.0 },
        { id: "CHN301", title: "Advanced Chinese Grammar", credits: 3.0 },
        { id: "CUL100", title: "Chinese Culture and Society", credits: 3.0 },
        { id: "CUL110", title: "Chinese Festivals and Customs", credits: 2.0 },
        { id: "CUL200", title: "Ancient Chinese Literature", credits: 3.0 },
        { id: "CUL210", title: "Chinese Philosophy Introduction", credits: 3.0 },
        { id: "CUL220", title: "Chinese Traditional Medicine", credits: 2.0 },
        { id: "CUL230", title: "Chinese Martial Arts", credits: 1.0 },
        { id: "CUL240", title: "Chinese Painting Basics", credits: 1.0 },
        { id: "CUL250", title: "Chinese Folk Arts", credits: 1.0 },
        { id: "CUL260", title: "Chinese Film and Media", credits: 3.0 },
        { id: "BUS300", title: "Business Chinese", credits: 3.0 },
        { id: "HIS100", title: "Chinese History Overview", credits: 3.0 },
        { id: "GEO100", title: "Chinese Geography", credits: 3.0 },
        { id: "LAW100", title: "Chinese Politics and Law", credits: 3.0 },
        { id: "ECO100", title: "Chinese Economic Development", credits: 3.0 },
        { id: "LIT400", title: "Modern Chinese Literature", credits: 3.0 },
      ]
      const grades = ["A", "A-", "B+", "B", "C+", "C", "W"]
      const gpaPoints = { A: 4.0, "A-": 3.7, "B+": 3.3, B: 3.0, "C+": 2.3, C: 2.0, W: 0 }
      const seed = Number.parseInt(studentIdSeed, 10) || Math.floor(Math.random() * 100000)
      const random = (offset) => seededRandom(seed + offset)
      const selectedCourses = []
      let totalAttempted = 0,
        totalEarned = 0,
        totalQualityPoints = 0
      const terms = []
      const currentJsDate = new Date()
      const currentYear = currentJsDate.getFullYear()
      const currentMonth = currentJsDate.getMonth() + 1
      const academicYearStartMonth = 9
      let currentTermYear = currentYear
      const currentTermSeason = currentMonth >= academicYearStartMonth || currentMonth <= 2 ? "Fall" : "Spring"
      if (currentMonth <= 2) currentTermYear--
      const startYear = 2023
      const startSeason = "Fall"
      for (let year = startYear; year <= currentTermYear; year++) {
        if (year === startYear && startSeason === "Spring") {
        } else {
          terms.push(`Fall ${year}`)
          if (year < currentTermYear || (year === currentTermYear && currentTermSeason === "Spring")) {
            terms.push(`Spring ${year + 1}`)
          }
        }
        if (year === currentTermYear && `Fall ${year}` === `${currentTermSeason} ${currentTermYear}`) break
        if (year + 1 === currentTermYear && `Spring ${year + 1}` === `${currentTermSeason} ${currentTermYear}`) break
      }
      const coursesPerTerm = 4
      const usedIndices = new Set()
      terms.forEach((term, termIndex) => {
        const termCourses = []
        let termAttempt = 0
        while (
          termCourses.length < coursesPerTerm &&
          usedIndices.size < coursePool.length &&
          termAttempt < coursePool.length * 2
        ) {
          const courseIdx = Math.floor(
            random(termIndex * 100 + termCourses.length * 5 + termAttempt) * coursePool.length,
          )
          termAttempt++
          if (!usedIndices.has(courseIdx)) {
            usedIndices.add(courseIdx)
            const course = coursePool[courseIdx]
            const gradeRoll = random(termIndex * 100 + termCourses.length * 5 + 1)
            const gradeIdx = Math.floor(gradeRoll * (grades.length - (gradeRoll < 0.05 ? 0 : 1)))
            const grade = grades[gradeIdx]
            const credit = course.credits
            const isEarned = grade !== "W"
            const qualityPts = isEarned ? credit * (gpaPoints[grade] || 0) : 0
            termCourses.push({ term, courseId: course.id, title: course.title, grade, credit })
            totalAttempted += credit
            if (isEarned) {
              totalEarned += credit
              totalQualityPoints += qualityPts
            }
          }
        }
        if (termCourses.length > 0) {
          selectedCourses.push({ term, courses: termCourses })
        }
      })
      const gpa = totalEarned > 0 ? (totalQualityPoints / totalEarned).toFixed(2) : "0.00"
      return { selectedCourses, totalAttempted, totalEarned, totalQualityPoints, gpa }
    },
    [seededRandom],
  )

  // Generate degree progress data
  const generateDegreeProgress = useCallback((totalEarned) => {
    const requirements = [
      { name: "Chinese Language Core", required: 45.0 },
      { name: "Culture & History", required: 24.0 },
      { name: "General Studies", required: 36.0 },
      { name: "Electives", required: 20.0 },
    ]

    // Distribute earned credits among requirements
    let remainingCredits = totalEarned
    const results = requirements.map((req) => {
      const allocated = Math.min(remainingCredits, req.required)
      remainingCredits -= allocated
      const percentComplete = Math.round((allocated / req.required) * 100)
      const status =
        percentComplete === 100
          ? "Complete"
          : percentComplete > 0
            ? `In Progress (${percentComplete}%)`
            : "Not Started (0%)"

      return {
        ...req,
        completed: allocated.toFixed(2),
        inProgress: "0.00",
        remaining: (req.required - allocated).toFixed(2),
        status,
      }
    })

    // Add total row
    const totalRequired = requirements.reduce((sum, req) => sum + req.required, 0)
    const totalCompleted = totalEarned
    const totalPercentComplete = Math.round((totalCompleted / totalRequired) * 100)
    const totalStatus =
      totalPercentComplete === 100
        ? "Complete"
        : totalPercentComplete > 0
          ? `In Progress (${totalPercentComplete}%)`
          : "Not Started (0%)"

    results.push({
      name: "Total Program Requirements",
      required: totalRequired.toFixed(2),
      completed: totalCompleted.toFixed(2),
      inProgress: "0.00",
      remaining: (totalRequired - totalCompleted).toFixed(2),
      status: totalStatus,
    })

    return results
  }, [])

  // useEffect to initialize data
  useEffect(() => {
    if (studentId && studentId !== "ERRORID") {
      const dobSeed = Number.parseInt(studentId, 10) || 12345
      setDateOfBirth(generateRandomDOB(dobSeed))

      const courseData = generateCoursesData(studentId)
      setCoursesData(courseData)

      const now = DateTime.now().setZone("Asia/Bishkek")
      setPrintDate(now.toFormat("MMMM dd, yyyy"))

      // Generate transcript number and verification code
      setTranscriptNo(`CI-TR-${now.toFormat("yyyyMMdd")}${studentId.substring(0, 2)}`)
      setVerificationCode(`CI${now.toFormat("yyMMdd")}-${studentId.substring(0, 6)}-TR`)

      // Set academic standing based on GPA
      const gpaNum = Number.parseFloat(courseData.gpa)
      if (gpaNum >= 3.5) {
        setAcademicStanding("Excellent Standing")
      } else if (gpaNum >= 3.0) {
        setAcademicStanding("Good Standing")
      } else if (gpaNum >= 2.0) {
        setAcademicStanding("Satisfactory")
      } else if (gpaNum > 0) {
        setAcademicStanding("Academic Probation")
      } else {
        setAcademicStanding("Not Started")
      }
    } else {
      // Set defaults if ID is missing
      setDateOfBirth("N/A")
      setCoursesData({ selectedCourses: [], totalAttempted: 0, totalEarned: 0, totalQualityPoints: 0, gpa: "N/A" })
      setPrintDate("N/A")
      setTranscriptNo("Transcript No. N/A")
      setVerificationCode("N/A")
      setAcademicStanding("N/A")
    }
  }, [studentId, generateRandomDOB, generateCoursesData])

  // Error handling
  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "red", fontFamily: "Arial, sans-serif" }}>
        <h2>Error Loading Transcript</h2>
        <p>{error}</p>
        <a href="/student-portal" style={{ color: "#007bff", textDecoration: "underline", marginRight: "15px" }}>
          Back to Portal
        </a>
        <a href="/" style={{ color: "#007bff", textDecoration: "underline" }}>
          Go to Login
        </a>
      </div>
    )
  }

  const displaySid = studentId && studentId !== "ERRORID" ? String(studentId).padStart(6, "0") : "N/A"
  const degreeProgress = generateDegreeProgress(coursesData.totalEarned)

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

      {/* Keep JsBarcode script */}
      <Script
        src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.JsBarcode && document.getElementById("barcode-svg") && displaySid !== "N/A") {
            try {
              window.JsBarcode("#barcode-svg", displaySid, {
                format: "CODE128",
                lineColor: "#000",
                width: 2,
                height: 50,
                displayValue: true,
                textMargin: 5,
              })
            } catch (e) {
              console.error("JsBarcode error:", e)
            }
          } else if (displaySid === "N/A") {
            console.warn("Student ID missing, cannot generate barcode.")
          }
        }}
        onError={(e) => {
          console.error("Failed to load JsBarcode script:", e)
        }}
      />

      <div className="watermark">CONFUCIUS INSTITUTE</div>

      <div className="transcript">
        <div className="header">
          <img
            src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png"
            alt="Confucius Institute Logo"
            className="logo"
          />
          <h1 className="title">OFFICIAL ACADEMIC TRANSCRIPT</h1>
          <p className="print-date">Print Date: {printDate}</p>

          <div className="verification-section">
            <p>Document ID: {transcriptNo}</p>
            <p>
              Verification Code: <span className="verification-code">{verificationCode}</span>
            </p>
            <p>Verify at: verify.kzxy.edu.kg</p>
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
                <td>{dateOfBirth || "N/A"}</td>
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
                <td>{coursesData.gpa}</td>
                <td>
                  <strong>Total Credits Attempted</strong>
                </td>
                <td>{coursesData.totalAttempted.toFixed(1)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Academic Standing</strong>
                </td>
                <td>{academicStanding}</td>
                <td>
                  <strong>Total Credits Earned</strong>
                </td>
                <td>{coursesData.totalEarned.toFixed(1)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Total Quality Points</strong>
                </td>
                <td>{coursesData.totalQualityPoints.toFixed(2)}</td>
                <td>
                  <strong>Current Semester</strong>
                </td>
                <td>
                  {new Date().getMonth() >= 8
                    ? `Fall ${new Date().getFullYear()}`
                    : `Spring ${new Date().getFullYear()}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="section">
          <div className="section-title">CONFUCIUS INSTITUTE AT KYRGYZ NATIONAL UNIVERSITY</div>

          {coursesData.selectedCourses.length === 0 ? (
            <p className="term-summary">No courses completed yet.</p>
          ) : (
            coursesData.selectedCourses.map((termData, termIdx) => (
              <div key={termIdx}>
                <div className="term-title">{termData.term}</div>
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
                    {termData.courses.map((course, courseIdx) => (
                      <tr key={courseIdx}>
                        <td>{course.courseId}</td>
                        <td>{course.title}</td>
                        <td>{course.grade}</td>
                        <td>{course.credit.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="term-summary">
                  Term Credits: {termData.courses.reduce((sum, course) => sum + course.credit, 0).toFixed(1)}
                </p>
              </div>
            ))
          )}
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
                <td>W</td>
                <td>Withdrawal (No point value)</td>
              </tr>
              <tr>
                <td>B</td>
                <td>3.0</td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="signatures">
          <div className="signature">
            <p>University Registrar</p>
          </div>
          <div className="signature">
            <p>Dean of Academic Affairs</p>
          </div>
        </div>

        <div className="barcode-container">
          {displaySid !== "N/A" ? (
            <svg id="barcode-svg" width="300" height="70"></svg>
          ) : (
            <p className="barcode-placeholder">Barcode N/A (ID Missing)</p>
          )}
        </div>

        <div className="footer">
          <p>This is an official academic transcript issued by Confucius Institute at Kyrgyz National University.</p>
          <p>
            Document ID: {transcriptNo} • Generated: {printDate}
          </p>
          <p>To verify the authenticity of this document, please visit verify.kzxy.edu.kg</p>
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
        
        .header img.logo {
          max-width: 200px;
          margin-bottom: 20px;
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
        
        .signature p {
          color: #006633;
          font-weight: bold;
          margin: 5px 0;
          padding-top: 40px;
          border-top: 1px solid #006633;
        }
        
        .barcode-container {
          text-align: center;
          margin: 30px 0;
        }
        
        .barcode-placeholder {
          color: grey;
          font-size: 12px;
          margin-top: 5px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
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
        }
        
        @media (max-width: 768px) {
          .transcript {
            padding: 15px;
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
