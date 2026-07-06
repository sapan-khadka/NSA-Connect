from datetime import UTC
from io import BytesIO

from fpdf import FPDF

from app.schemas.report import ReportData


class ReportPDF(FPDF):
    def header(self) -> None:
        self.set_font("Helvetica", "B", 16)
        self.cell(0, 10, "NSA Connect", ln=True, align="C")
        self.set_font("Helvetica", "", 10)
        self.cell(0, 6, "Nepalese Students' Association", ln=True, align="C")
        self.ln(4)

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def _section_heading(pdf: ReportPDF, title: str) -> None:
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(0, 8, title, ln=True, fill=True)
    pdf.ln(2)


def _metric_line(pdf: ReportPDF, label: str, value: str) -> None:
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(70, 6, label)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, value, ln=True)


def _money(value) -> str:
    return f"${float(value):,.2f}"


def generate_report_pdf(data: ReportData) -> bytes:
    pdf = ReportPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 8, data.title, ln=True, align="C")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Period: {data.period_label}", ln=True, align="C")
    generated = data.generated_at.astimezone(UTC).strftime("%B %d, %Y")
    pdf.cell(0, 6, f"Generated: {generated}", ln=True, align="C")
    pdf.ln(6)

    _section_heading(pdf, "Events")
    _metric_line(pdf, "Total events held:", str(data.events.total_events))
    pdf.ln(2)
    if data.events.events:
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(55, 6, "Event")
        pdf.cell(25, 6, "Date")
        pdf.cell(22, 6, "Category")
        pdf.cell(20, 6, "Attended")
        pdf.cell(0, 6, "RSVP summary", ln=True)
        pdf.set_font("Helvetica", "", 9)
        for event in data.events.events:
            date_label = event.starts_at.astimezone(UTC).strftime("%Y-%m-%d")
            rsvp = (
                f"{event.rsvp_going_attended} attended / "
                f"{event.rsvp_going_no_show} no-show / "
                f"{event.walk_ins} walk-ins"
            )
            pdf.cell(55, 6, event.name[:30])
            pdf.cell(25, 6, date_label)
            pdf.cell(22, 6, event.event_type)
            pdf.cell(20, 6, str(event.attendance_count))
            pdf.cell(0, 6, rsvp, ln=True)
    pdf.ln(4)

    _section_heading(pdf, "Attendance")
    _metric_line(pdf, "Total check-ins:", str(data.attendance.total_checkins))
    _metric_line(pdf, "Member check-ins:", str(data.attendance.total_member_checkins))
    _metric_line(pdf, "Guest check-ins:", str(data.attendance.total_guest_checkins))
    _metric_line(
        pdf,
        "Events with check-ins:",
        str(data.attendance.events_with_checkins),
    )
    pdf.ln(4)

    _section_heading(pdf, "Finance")
    _metric_line(pdf, "Total income:", _money(data.finance.total_income))
    _metric_line(pdf, "Total expenses:", _money(data.finance.total_expense))
    _metric_line(pdf, "Net balance:", _money(data.finance.net_balance))
    _metric_line(pdf, "Entries logged:", str(data.finance.entry_count))
    pdf.ln(4)

    _section_heading(pdf, "Dues")
    if data.dues.semesters:
        semesters = ", ".join(data.dues.semesters)
        _metric_line(pdf, "Semesters included:", semesters)
    _metric_line(pdf, "Total expected:", _money(data.dues.total_expected))
    _metric_line(pdf, "Total collected:", _money(data.dues.total_collected))
    _metric_line(pdf, "Total outstanding:", _money(data.dues.total_outstanding))
    _metric_line(pdf, "Paid members:", str(data.dues.paid_count))
    _metric_line(pdf, "Unpaid members:", str(data.dues.unpaid_count))
    pdf.ln(4)

    _section_heading(pdf, "Feedback")
    rating = (
        f"{data.feedback.average_rating:.1f} / 5"
        if data.feedback.average_rating is not None
        else "N/A"
    )
    _metric_line(pdf, "Average rating:", rating)
    _metric_line(pdf, "Total responses:", str(data.feedback.response_count))
    _metric_line(
        pdf,
        "Events with feedback:",
        str(data.feedback.events_with_feedback),
    )
    pdf.ln(4)

    _section_heading(pdf, "Membership")
    _metric_line(pdf, "Total approved members:", str(data.membership.total_approved))
    _metric_line(pdf, "Board+ members:", str(data.membership.board_plus_count))
    _metric_line(pdf, "General members:", str(data.membership.general_count))

    buffer = BytesIO()
    pdf.output(buffer)
    return buffer.getvalue()
