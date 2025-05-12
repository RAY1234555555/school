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
  const [degreeProgress, setDegreeProgress] = useState([])
  const [currentTerm, setCurrentTerm] = useState("")
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

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

  // Updated course pool with more Confucius Institute appropriate courses
  const confuciusCoursePool = [
    { id: "CHN101", title: "Elementary Chinese Speaking", credits: 3.0 },
    { id: "CHN102", title: "Elementary Chinese Reading", credits: 3.0 },
    { id: "CHN103", title: "Elementary Chinese Writing", credits: 3.0 },
    { id: "CHN104", title: "Elementary Chinese Listening", credits: 3.0 },
    { id: "CHN201", title: "Intermediate Chinese Speaking", credits: 3.0 },
    { id: "CHN202", title: "Intermediate Chinese Reading", credits: 3.0 },
    { id: "CHN203", title: "Intermediate Chinese Writing", credits: 3.0 },
    { id: "CHN204", title: "Intermediate Chinese Listening", credits: 3.0 },
    { id: "CHN301", title: "Advanced Chinese Grammar", credits: 3.0 },
    { id: "CHN302", title: "Advanced Chinese Composition", credits: 3.0 },
    { id: "CHN303", title: "Business Chinese", credits: 3.0 },
    { id: "CHN304", title: "Chinese for Academic Purposes", credits: 3.0 },
    { id: "CUL100", title: "Chinese Culture and Society", credits: 3.0 },
    { id: "CUL110", title: "Chinese Festivals and Customs", credits: 2.0 },
    { id: "CUL120", title: "Chinese Calligraphy", credits: 2.0 },
    { id: "CUL130", title: "Chinese Tea Culture", credits: 2.0 },
    { id: "CUL200", title: "Ancient Chinese Literature", credits: 3.0 },
    { id: "CUL210", title: "Chinese Philosophy Introduction", credits: 3.0 },
    { id: "CUL220", title: "Chinese Traditional Medicine", credits: 2.0 },
    { id: "CUL230", title: "Chinese Martial Arts", credits: 1.0 },
    { id: "CUL240", title: "Chinese Painting Basics", credits: 1.0 },
    { id: "CUL250", title: "Chinese Folk Arts", credits: 1.0 },
    { id: "CUL260", title: "Chinese Film and Media", credits: 3.0 },
    { id: "HIS100", title: "Chinese History Overview", credits: 3.0 },
    { id: "HIS110", title: "Modern Chinese History", credits: 3.0 },
    { id: "HIS120", title: "Chinese Dynasties", credits: 3.0 },
    { id: "GEO100", title: "Chinese Geography", credits: 3.0 },
    { id: "POL100", title: "Chinese Politics and Law", credits: 3.0 },
    { id: "ECO100", title: "Chinese Economic Development", credits: 3.0 },
    { id: "LIT100", title: "Modern Chinese Literature", credits: 3.0 },
  ]

  // Simplified to generate fewer terms with fixed number of courses
  const generateCoursesData = useCallback(
    (studentIdSeed) => {
      const grades = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "W"]
      const gpaPoints = {
        A: 4.0,
        "A-": 3.7,
        "B+": 3.3,
        B: 3.0,
        "B-": 2.7,
        "C+": 2.3,
        C: 2.0,
        "C-": 1.7,
        "D+": 1.3,
        D: 1.0,
        W: 0,
      }

      const seed = Number.parseInt(studentIdSeed, 10) || Math.floor(Math.random() * 100000)
      const random = (offset) => seededRandom(seed + offset)
      const selectedCourses = []
      let totalAttempted = 0,
        totalEarned = 0,
        totalQualityPoints = 0

      // Simplified terms - just use 2 terms
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear()
      
      // Just use Fall and Spring of the current year
      const terms = [`Fall ${currentYear-1}`, `Spring ${currentYear}`]
      setCurrentTerm(`Spring ${currentYear}`)

      // For each term, generate exactly 4 courses
      const usedCourseIndices = new Set()

      terms.forEach((term, termIndex) => {
        const coursesPerTerm = 4 // Fixed at 4 courses per term
        const termCourses = []

        // Try to add unique courses up to coursesPerTerm
        for (let i = 0; i < coursesPerTerm; i++) {
          // Find an unused course
          let attempts = 0
          let courseIdx

          do {
            courseIdx = Math.floor(random(termIndex * 100 + i * 10) * confuciusCoursePool.length)
            attempts++
          } while (usedCourseIndices.has(courseIdx) && attempts < 30)

          // If we found a new course or tried enough times, use it
          if (!usedCourseIndices.has(courseIdx) || attempts >= 30) {
            if (!usedCourseIndices.has(courseIdx)) {
              usedCourseIndices.add(courseIdx)
            }

            const course = confuciusCoursePool[courseIdx]

            // Generate grade based on student ID and course
            const gradeRoll = random(termIndex * 100 + i * 10 + 1)
            // Weight grades to be more realistic (more common to get B range)
            let gradeIdx
            if (gradeRoll < 0.15)
              gradeIdx = 0 // A
            else if (gradeRoll < 0.25)
              gradeIdx = 1 // A-
            else if (gradeRoll < 0.4)
              gradeIdx = 2 // B+
            else if (gradeRoll < 0.6)
              gradeIdx = 3 // B
            else if (gradeRoll < 0.7)
              gradeIdx = 4 // B-
            else if (gradeRoll < 0.8)
              gradeIdx = 5 // C+
            else if (gradeRoll < 0.9)
              gradeIdx = 6 // C
            else if (gradeRoll < 0.95)
              gradeIdx = 7 // C-
            else if (gradeRoll < 0.97)
              gradeIdx = 8 // D+
            else if (gradeRoll < 0.99)
              gradeIdx = 9 // D
            else gradeIdx = 10 // W (rare)

            const grade = grades[gradeIdx]
            const credit = course.credits
            const isEarned = grade !== "W"
            const qualityPts = isEarned ? credit * (gpaPoints[grade] || 0) : 0

            termCourses.push({
              term,
              courseId: course.id,
              title: course.title,
              grade,
              credit,
            })

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

  // Generate degree progress data with randomized values
  const generateDegreeProgress = useCallback(
    (totalEarned, seed) => {
      const random = (offset) => seededRandom(seed + offset)

      // Total program requirement is fixed at 150 credits
      const totalRequired = 150.0

      // Define requirements with randomized proportions
      const requirementProportions = [
        { name: "Chinese Language Core", proportion: 0.3 + random(1) * 0.1 }, // 30-40%
        { name: "Culture & History", proportion: 0.2 + random(2) * 0.1 }, // 20-30%
        { name: "General Studies", proportion: 0.2 + random(3) * 0.1 }, // 20-30%
        { name: "Electives", proportion: 0.1 + random(4) * 0.1 }, // 10-20%
      ]

      // Normalize proportions to ensure they sum to 1
      const totalProportion = requirementProportions.reduce((sum, req) => sum + req.proportion, 0)
      requirementProportions.forEach((req) => (req.proportion = req.proportion / totalProportion))

      // Calculate required credits for each category
      const requirements = requirementProportions.map((req) => ({
        name: req.name,
        required: Math.round(totalRequired * req.proportion * 10) / 10, // Round to 1 decimal place
      }))

      // Adjust the last requirement to ensure total is exactly 150
      const calculatedTotal = requirements.reduce((sum, req) => sum + req.required, 0)
      const lastIndex = requirements.length - 1
      requirements[lastIndex].required =
        Math.round((requirements[lastIndex].required + (totalRequired - calculatedTotal)) * 10) / 10

      // Distribute earned credits among requirements with some randomness
      let remainingCredits = totalEarned
      const inProgressCredits = random(10) * 10 // 0-10 credits in progress

      const results = requirements.map((req, index) => {
        // Allocate credits with some randomness
        const maxAllocation = Math.min(remainingCredits, req.required)
        const allocation = Math.round(maxAllocation * (0.7 + random(index * 5) * 0.6) * 10) / 10
        remainingCredits -= allocation

        // Allocate some in-progress credits
        const inProgressAllocation = index === 0 ? Math.round(inProgressCredits * 10) / 10 : 0

        const percentComplete = Math.round((allocation / req.required) * 100)
        const status =
          percentComplete === 100
            ? "Complete"
            : percentComplete > 0
              ? `In Progress (${percentComplete}%)`
              : "Not Started (0%)"

        return {
          ...req,
          completed: allocation.toFixed(2),
          inProgress: inProgressAllocation.toFixed(2),
          remaining: (req.required - allocation).toFixed(2),
          status,
        }
      })

      // Add total row
      const totalCompleted = results.reduce((sum, req) => sum + Number.parseFloat(req.completed), 0)
      const totalInProgress = results.reduce((sum, req) => sum + Number.parseFloat(req.inProgress), 0)
      const totalRemaining = totalRequired - totalCompleted
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
        inProgress: totalInProgress.toFixed(2),
        remaining: totalRemaining.toFixed(2),
        status: totalStatus,
      })

      return results
    },
    [seededRandom],
  )

  // PDF generation function
  const generatePDF = useCallback(() => {
    setIsGeneratingPdf(true)
    
    // Import html2pdf dynamically
    import('html2pdf.js').then((html2pdf) => {
      const element = document.querySelector('.transcript')
      const opt = {
        margin: 10,
        filename: `transcript_${displaySid}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }
      
      html2pdf.default()
        .set(opt)
        .from(element)
        .save()
        .then(() => {
          setIsGeneratingPdf(false)
        })
        .catch(err => {
          console.error('Error generating PDF:', err)
          setIsGeneratingPdf(false)
          alert('Failed to generate PDF. Please try again.')
        })
    }).catch(err => {
      console.error('Error loading html2pdf:', err)
      setIsGeneratingPdf(false)
      alert('Failed to load PDF generator. Please try again.')
    })
  }, [])

  // useEffect to initialize data
  useEffect(() => {
    const displaySid = studentId && studentId !== "ERRORID" ? String(studentId).padStart(6, "0") : "N/A"

    if (studentId && studentId !== "ERRORID") {
      const dobSeed = Number.parseInt(studentId, 10) || 12345
      setDateOfBirth(generateRandomDOB(dobSeed))

      const courseData = generateCoursesData(studentId)
      setCoursesData(courseData)

      // Generate degree progress with randomized values
      setDegreeProgress(generateDegreeProgress(courseData.totalEarned, dobSeed))

      const now = DateTime.now().setZone("America/New_York")
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
  }, [studentId, generateRandomDOB, generateCoursesData, generateDegreeProgress])

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
  const degreeProgressData = generateDegreeProgress(coursesData.totalEarned)

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

      <div className="pdf-button-container">
        <button 
          className="pdf-button" 
          onClick={generatePDF} 
          disabled={isGeneratingPdf || displaySid === "N/A"}
        >
          {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}
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
                <td>{currentTerm}</td>
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
              {degreeProgressData.map((req, index) => (
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
