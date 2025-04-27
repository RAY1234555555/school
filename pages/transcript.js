import Head from 'next/head'
import { parse } from 'cookie'
import { DateTime } from 'luxon'

// 生成固定随机课程
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// 生成英文课程
function generateCourses(studentId) {
  const coursePool = [
    { id: 'CHN101', title: 'Elementary Chinese Speaking' },
    { id: 'CHN102', title: 'Elementary Chinese Reading' },
    { id: 'CHN201', title: 'Intermediate Chinese Speaking' },
    { id: 'CHN202', title: 'Intermediate Chinese Reading' },
    { id: 'CHN301', title: 'Advanced Chinese Grammar' },
    { id: 'CUL100', title: 'Chinese Culture and Society' },
    { id: 'CUL110', title: 'Chinese Festivals and Customs' },
    { id: 'CUL200', title: 'Ancient Chinese Literature' },
    { id: 'CUL210', title: 'Chinese Philosophy Introduction' },
    { id: 'CUL220', title: 'Chinese Traditional Medicine' },
    { id: 'CUL230', title: 'Chinese Martial Arts' },
    { id: 'CUL240', title: 'Chinese Painting Basics' },
    { id: 'CUL250', title: 'Chinese Folk Arts' },
    { id: 'CUL260', title: 'Chinese Film and Media' },
    { id: 'BUS300', title: 'Business Chinese' },
    { id: 'HIS100', title: 'Chinese History Overview' },
    { id: 'GEO100', title: 'Chinese Geography' },
    { id: 'LAW100', title: 'Chinese Politics and Law' },
    { id: 'ECO100', title: 'Chinese Economic Development' },
    { id: 'LIT400', title: 'Modern Chinese Literature' },
  ]

  const grades = ['A', 'A-', 'B+', 'B', 'C+', 'C', 'W']
  const gpaPoints = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'C+': 2.3, 'C': 2.0, 'W': 0 }

  const random = (seed, i) => seededRandom(seed + i)

  const selected = []
  let totalAttempted = 0
  let totalEarned = 0
  let totalQualityPoints = 0

  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(random(studentId, i) * coursePool.length)
    const course = coursePool[idx]
    const gradeIdx = Math.floor(random(studentId, i + 10) * (grades.length - 1))
    const grade = grades[gradeIdx]
    const credit = (Math.floor(random(studentId, i + 20) * 2) + 2)

    selected.push({
      term: i < 3 ? 'Fall 2025' : 'Spring 2026',
      courseId: course.id,
      title: course.title,
      grade,
      credit,
      earned: grade !== 'W' ? credit : 0,
      qualityPoints: grade !== 'W' ? (credit * gpaPoints[grade]) : 0,
    })

    totalAttempted += credit
    totalEarned += grade !== 'W' ? credit : 0
    totalQualityPoints += grade !== 'W' ? (credit * gpaPoints[grade]) : 0
  }

  const gpa = totalEarned ? (totalQualityPoints / totalEarned).toFixed(2) : '0.00'

  return { selected, totalAttempted, totalEarned, totalQualityPoints, gpa }
}

export async function getServerSideProps({ req }) {
  const cookies = parse(req.headers.cookie || '')
  const oauthUsername = cookies.oauthUsername || 'Unknown Student'
  const oauthFullName = cookies.oauthFullName || oauthUsername
  const oauthUserId = cookies.oauthUserId || '000000'

  const { selected, totalAttempted, totalEarned, totalQualityPoints, gpa } = generateCourses(parseInt(oauthUserId, 10))

  const now = DateTime.now().setZone('America/New_York')
  const printDate = now.toFormat('MMMM dd, yyyy')
  const transcriptNo = `Transcript No. ${now.toFormat('yyyyMMdd')}-${oauthUserId}`

  return {
    props: {
      fullName: oauthFullName,
      studentId: oauthUserId,
      selected,
      totalAttempted,
      totalEarned,
      totalQualityPoints,
      gpa,
      printDate,
      transcriptNo,
    }
  }
}

export default function Transcript({ fullName, studentId, selected, totalAttempted, totalEarned, totalQualityPoints, gpa, printDate, transcriptNo }) {
  const sid = String(studentId).padStart(6, '0') // 保持6位格式

  return (
    <>
      <Head>
        <title>Transcript - Confucius Institute</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      </Head>

      <div className="page" id="transcript">
        <div className="watermark">Confucius Institute Official Seal</div>

        <div className="header">
          <img src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png" alt="Logo" className="logo" />
          <div className="school-info">
            <h1>Confucius Institute at Kyrgyz National University</h1>
            <p>66 Manas Avenue, Bishkek, 720033, Kyrgyz Republic</p>
          </div>
        </div>

        <div className="print-info">
          {transcriptNo}<br />
          Print Date: {printDate}
        </div>

        <h2>Student Information</h2>
        <div className="info-grid">
          <div><strong>Student Name:</strong> {fullName}</div>
          <div><strong>Student ID:</strong> {sid}</div>
          <div><strong>Enrollment Status:</strong> Active</div>
        </div>

        <h2>Institutional Coursework</h2>
        <table className="courses">
          <thead>
            <tr>
              <th>Term</th>
              <th>Course ID</th>
              <th>Course Title</th>
              <th>Grade</th>
              <th>Credits</th>
            </tr>
          </thead>
          <tbody>
            {selected.map((course, idx) => (
              <tr key={idx}>
                <td>{course.term}</td>
                <td>{course.courseId}</td>
                <td>{course.title}</td>
                <td>{course.grade}</td>
                <td>{course.credit.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Academic Summary</h2>
        <div className="info-grid">
          <div><strong>Total Attempted Hours:</strong> {totalAttempted.toFixed(1)}</div>
          <div><strong>Total Earned Hours:</strong> {totalEarned.toFixed(1)}</div>
          <div><strong>Total Quality Points:</strong> {totalQualityPoints.toFixed(2)}</div>
          <div><strong>Institutional GPA:</strong> {gpa}</div>
        </div>

        <div className="footer">
          Page 1 of 1 | *** End of Unofficial Transcript ***
        </div>
      </div>

      {/* PDF导出按钮 */}
      <div className="print-button">
        <button onClick={() => {
          const element = document.getElementById('transcript');
          html2pdf().set({
            margin: 0.5,
            filename: 'transcript.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
          }).from(element).save();
        }}>
          Download Transcript (PDF)
        </button>
      </div>

      <style jsx>{`
        .page { background: #fff; padding: 1in; margin: 20px auto; max-width: 8.5in; box-shadow: 0 0 10px rgba(0,0,0,0.1); position: relative; font-family: 'Times New Roman', serif; font-size: 11pt; }
        .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 48px; color: rgba(200,200,200,0.2); pointer-events: none; user-select: none; white-space: nowrap; }
        .header { text-align: center; margin-bottom: 20px; }
        .logo { height: 80px; margin-bottom: 10px; }
        .school-info h1 { margin: 0; font-size: 20px; }
        .print-info { text-align: right; margin-bottom: 20px; }
        h2 { border-bottom: 1px solid #000; margin-top: 20px; font-size: 16px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin-bottom: 20px; }
        .courses { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .courses th, .courses td { border: 1px solid #000; padding: 8px; text-align: center; }
        .footer { margin-top: 40px; text-align: center; font-size: 9pt; color: #666; }
        .print-button { text-align: center; margin: 20px; }
        .print-button button { padding: 10px 20px; font-size: 16px; background: #0070f3; color: white; border: none; border-radius: 6px; cursor: pointer; }
        @media print { .print-button { display: none; } .page { box-shadow: none; margin: 0; } }
      `}</style>
    </>
  )
}
