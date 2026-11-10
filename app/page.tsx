export default function HomePage() {
  const today = new Date().toISOString().split('T')[0];
  return (
    <div className="app-container">
      {/* Top App Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-icon">
            <i className="fa-solid fa-clipboard-user"></i>
          </div>
          <div>
            <h1>Student Attendance Tracker</h1>
            <p className="subtitle">Daily Classroom Attendance &amp; Live Performance Tracking</p>
          </div>
        </div>

        {/* Date Selector Control */}
        <div className="date-control-card">
          <button id="prevDateBtn" className="btn btn-icon" title="Previous Day">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <div className="date-input-wrapper">
            <i className="fa-regular fa-calendar"></i>
            <input type="date" id="attendanceDate" defaultValue={today} />
          </div>
          <button id="nextDateBtn" className="btn btn-icon" title="Next Day">
            <i className="fa-solid fa-chevron-right"></i>
          </button>
          <button id="todayDateBtn" className="btn btn-sm btn-outline">Today</button>
        </div>
      </header>

      {/* Live Analytics Summary Dashboard */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon icon-blue">
            <i className="fa-solid fa-users"></i>
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Students</span>
            <h2 className="stat-value" id="statTotalStudents">0</h2>
            <span className="stat-subtext">Registered in class</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon icon-green">
            <i className="fa-solid fa-user-check"></i>
          </div>
          <div className="stat-content">
            <span className="stat-label">Present Today</span>
            <h2 className="stat-value text-green" id="statPresentCount">0</h2>
            <span className="stat-subtext">Attending class</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon icon-red">
            <i className="fa-solid fa-user-xmark"></i>
          </div>
          <div className="stat-content">
            <span className="stat-label">Absent Today</span>
            <h2 className="stat-value text-red" id="statAbsentCount">0</h2>
            <span className="stat-subtext">Missing or on leave</span>
          </div>
        </div>

        <div className="stat-card stat-card-featured">
          <div className="stat-featured-header">
            <div>
              <span className="stat-label">Live Attendance Rate</span>
              <div className="percentage-display">
                <h2 className="stat-value" id="statPercentage">0.0%</h2>
                <span className="badge" id="rateStatusBadge">Good</span>
              </div>
            </div>
            <div className="radial-ring-wrap">
              <svg className="progress-ring" width="56" height="56">
                <circle className="progress-ring__circle-bg" stroke="#e2e8f0" strokeWidth="5" fill="transparent" r="23" cx="28" cy="28" />
                <circle className="progress-ring__circle" id="radialCircle" stroke="#10b981" strokeWidth="5" strokeDasharray="144.5" strokeDashoffset="144.5" strokeLinecap="round" fill="transparent" r="23" cx="28" cy="28" />
              </svg>
            </div>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" id="statProgressBar" style={{ width: '0%' }}></div>
          </div>
          <span className="stat-subtext" id="statRateDescription">Calculated in real-time</span>
        </div>
      </section>

      {/* Main Workspace Card */}
      <main className="main-card">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input type="text" id="searchInput" placeholder="Search by name or roll number..." />
              <button id="clearSearchBtn" className="clear-btn" style={{ display: 'none' }}>&times;</button>
            </div>
            <div className="filter-group">
              <button className="filter-chip active" data-filter="all">All (<span id="countFilterAll">0</span>)</button>
              <button className="filter-chip" data-filter="Present">Present (<span id="countFilterPresent">0</span>)</button>
              <button className="filter-chip" data-filter="Absent">Absent (<span id="countFilterAbsent">0</span>)</button>
              <button className="filter-chip" data-filter="Unmarked">Unmarked (<span id="countFilterUnmarked">0</span>)</button>
            </div>
          </div>
          <div className="toolbar-right">
            <div className="btn-group">
              <button id="markAllPresentBtn" className="btn btn-sm btn-outline-success" title="Mark all students present">
                <i className="fa-solid fa-check-double"></i> Mark All Present
              </button>
              <button id="markAllAbsentBtn" className="btn btn-sm btn-outline-danger" title="Mark all students absent">
                <i className="fa-solid fa-xmark"></i> Mark All Absent
              </button>
            </div>
            <button id="openAddModalBtn" className="btn btn-primary">
              <i className="fa-solid fa-user-plus"></i> Add Student
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="attendance-table" id="attendanceTable">
            <thead>
              <tr>
                <th style={{ width: '12%' }}>Roll No</th>
                <th style={{ width: '30%' }}>Student Name</th>
                <th style={{ width: '28%' }}>Attendance Status (Live)</th>
                <th style={{ width: '20%' }}>Historical Record</th>
                <th style={{ width: '10%' }} className="text-center">Action</th>
              </tr>
            </thead>
            <tbody id="studentTableBody"></tbody>
          </table>

          <div id="emptyState" className="empty-state" style={{ display: 'none' }}>
            <div className="empty-icon">
              <i className="fa-solid fa-user-graduate"></i>
            </div>
            <h3>No Students Found</h3>
            <p>There are no students matching your query. Add your first student to get started!</p>
            <button className="btn btn-primary" id="emptyStateAddBtn">
              <i className="fa-solid fa-user-plus"></i> Add Student
            </button>
          </div>

          <div id="loadingState" className="loading-state">
            <div className="spinner"></div>
            <p>Loading attendance data...</p>
          </div>
        </div>

        <div className="table-footer">
          <div className="footer-info">
            <span id="showingCountText">Showing 0 students</span>
            <span className="live-indicator"><span className="dot"></span> Changes auto-save in real-time</span>
          </div>
          <div className="footer-actions">
            <button id="saveAllBtn" className="btn btn-success">
              <i className="fa-solid fa-floppy-disk"></i> Force Save All
            </button>
          </div>
        </div>
      </main>

      {/* Modal: Add New Student */}
      <div className="modal-overlay" id="addStudentModal">
        <div className="modal-dialog">
          <div className="modal-header">
            <div className="modal-title-wrap">
              <div className="modal-icon">
                <i className="fa-solid fa-user-plus"></i>
              </div>
              <h3>Add New Student</h3>
            </div>
            <button className="modal-close-btn" id="closeAddModalBtn">&times;</button>
          </div>
          <form id="addStudentForm">
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="studentNameInput">Full Name <span className="required">*</span></label>
                <input type="text" id="studentNameInput" placeholder="e.g. John Doe" required autoFocus />
              </div>
              <div className="form-group">
                <label htmlFor="studentRollInput">Roll Number / Student ID</label>
                <input type="text" id="studentRollInput" placeholder="e.g. STU-106 (optional, auto-generated if blank)" />
                <small className="form-hint">Unique identifier for the student.</small>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" id="cancelAddBtn">Cancel</button>
              <button type="submit" className="btn btn-primary" id="saveStudentBtn">
                <i className="fa-solid fa-check"></i> Add Student
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast Notification Container */}
      <div id="toastContainer" className="toast-container"></div>

      {/* Script */}
      <script src="/script.js" defer></script>
    </div>
  );
}
