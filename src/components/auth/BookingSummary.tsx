import { CalendarDays, Music } from "lucide-react";

export function BookingSummary({ discipline, date, time, onEditDiscipline, onEditSchedule }: {
  discipline: string;
  date?: string;
  time?: string;
  onEditDiscipline?: () => void;
  onEditSchedule?: () => void;
}) {
  return (
    <div className="booking-summary" aria-label="Your trial selection">
      <h2>Your trial lesson</h2>
      <div className="booking-summary-row">
        <Music size={19} aria-hidden="true" />
        <p><span>Discipline</span><strong>{discipline}</strong></p>
        {onEditDiscipline && <button type="button" aria-label="Edit discipline" onClick={onEditDiscipline}>Edit</button>}
      </div>
      {date && <div className="booking-summary-row">
        <CalendarDays size={19} aria-hidden="true" />
        <p><span>Preferred schedule</span><strong>{date}{time && <><br />{time}</>}</strong></p>
        {onEditSchedule && <button type="button" aria-label="Edit preferred schedule" onClick={onEditSchedule}>Edit</button>}
      </div>}
      <footer><span>Trial lesson</span><strong>Free</strong></footer>
    </div>
  );
}
