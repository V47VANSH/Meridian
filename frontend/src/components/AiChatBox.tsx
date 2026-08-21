import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import { api } from "../api/client";
import {
  bookings,
  complaints,
  guestPasses,
  announcements,
  invoices,
  residents,
  staffTasks,
  sosAlerts,
  facilities,
  timeSlots,
  notifyMockDataChanged,
  useMockData,
} from "../api/mockData";

interface AIAssistantResponse {
  reply: string;
  card_type?: Message["cardType"] | null;
  action_data?: Record<string, any> | null;
  provider?: string;
}

interface Message {
  id: string;
  sender: "user" | "system";
  text: string;
  timestamp: Date;
  cardType?:
    | "booking"
    | "complaint"
    | "guestpass"
    | "announcements"
    | "dues"
    | "sos"
    | "mybookings"
    | "residentDirectory"
    | "complaintTriage"
    | "announcementCompose"
    | "bookingsSchedule"
    | "propertyStatus"
    | "verifyPass"
    | "sosInbox"
    | "staffTasks";
}

// Pseudo QR helper for the guest pass card (matches the design in GuestPassGeneratePage)
function MiniQR({ seed }: { seed: string }) {
  const cells = Array.from({ length: 64 }, (_, i) => {
    const code = seed.charCodeAt(i % seed.length) + i;
    return code % 3 !== 0;
  });
  return (
    <div className="grid grid-cols-8 gap-0.5 w-20 h-20 bg-ink-100 p-1.5 rounded-sm mx-auto my-2">
      {cells.map((filled, i) => (
        <div key={i} className={filled ? "bg-blueprint-950" : "bg-ink-100"} />
      ))}
    </div>
  );
}

export default function AiChatBox() {
  useMockData(); // listen to mockData changes globally
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize welcome message when user logs in or chat opens
  useEffect(() => {
    if (user && isOpen && messages.length === 0) {
      let welcomeText = "";
      switch (user.role) {
        case "RESIDENT_OWNER":
          welcomeText = `SYSTEM INITIALIZED. Authenticated as: ${user.name} (Resident). Welcome to Meridian Society OS. How can I assist you with flat ${user.flatNo || "N/A"} today? You can book amenities, raise complaints, or generate visitor guest passes.`;
          break;
        case "SOCIETY_OFFICIAL":
          welcomeText = `MANAGEMENT CONSOLE ACTIVE. Authenticated as: ${user.name} (Official). Society records unlocked. How can I assist you with administration today? You can triage complaints, compose announcements, and search residents.`;
          break;
        case "NON_RESIDENT_OWNER":
          welcomeText = `PROPERTY DASHBOARD ACTIVE. Authenticated as: ${user.name} (Non-Resident Owner). Remote monitoring active. How can I assist you today? You can check tenant occupancy, dues, and announcements.`;
          break;
        case "SECURITY_GUARD":
          welcomeText = `SECURITY TERMINAL ACTIVE. Gate operations console unlocked. How can I assist with security today? You can verify visitor guest passes and monitor SOS alerts.`;
          break;
        case "MAINTENANCE_STAFF":
          welcomeText = `STAFF CONSOLE ACTIVE. Work order logs unlocked. How can I assist you with tasks today? You can check your assigned tasks and update work progress.`;
          break;
        default:
          welcomeText = `SYSTEM INITIALIZED. Authenticated as: ${user.name}. Welcome to Meridian Society OS. How can I assist you today?`;
      }
      setMessages([
        {
          id: "welcome",
          sender: "system",
          text: welcomeText,
          timestamp: new Date(),
        },
      ]);
    }
  }, [user, isOpen, messages.length]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  if (!user) return null;

  function pushSystemMessage(text: string, cardType?: Message["cardType"]) {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random()}`,
        sender: "system",
        text,
        timestamp: new Date(),
        cardType,
      },
    ]);
  }

  async function handleSend(textToSend?: string) {
    if (!user) return;
    const userRole = user.role;
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    if (!textToSend) {
      setInputValue("");
    }

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: "user",
        text,
        timestamp: new Date(),
      },
    ]);

    setIsLoading(true);

    try {
      // Call backend Gemini AI Assistant API
      const res = await api.post<AIAssistantResponse>("/v1/ai/assistant", { prompt: text });
      setIsLoading(false);

      if (res && res.reply) {
        pushSystemMessage(res.reply, (res.card_type as Message["cardType"]) || undefined);
        return;
      }
    } catch {
      // Fallback local processing if backend endpoint unavailable
      setIsLoading(false);
    }

    // Local Fallback Parsing if backend request fails
    const lower = text.toLowerCase();

    // HELP COMMAND
    if (lower.includes("help") || lower.includes("menu") || lower.includes("option")) {
      let helpText = "";
      switch (userRole) {
        case "RESIDENT_OWNER":
          helpText = "I can assist you with the following tasks. Ask me directly to:\n- 'Book facility slot' (Clubhouse, Gym, etc.)\n- 'Cancel booking' or 'Show my bookings'\n- 'Raise a complaint' / 'Report issue'\n- 'Generate a guest pass'\n- 'View announcements'\n- 'Check my dues' / 'Pay bills'\n- 'Trigger emergency SOS'";
          break;
        case "SOCIETY_OFFICIAL":
          helpText = "Society Official administrative commands:\n- 'Show resident directory' / 'Check dues'\n- 'Triage complaints' / 'View open complaints'\n- 'Post announcement' / 'Compose notice'\n- 'Show bookings schedule' / 'View reservations'";
          break;
        case "NON_RESIDENT_OWNER":
          helpText = "Non-Resident Owner remote monitoring commands:\n- 'Check property status' / 'Occupancy'\n- 'Generate visitor pass'\n- 'View notices'\n- 'View/pay pending maintenance bills'";
          break;
        case "SECURITY_GUARD":
          helpText = "Security Guard Gate operations commands:\n- 'Verify guest pass' / 'Check-in visitor'\n- 'Show SOS alerts' / 'View active alarms'";
          break;
        case "MAINTENANCE_STAFF":
          helpText = "Staff work order commands:\n- 'Show my tasks' / 'Task queue'";
          break;
      }
      pushSystemMessage(helpText);
      return;
    }

    if (userRole === "SOCIETY_OFFICIAL") {
      if (lower.includes("directory") || lower.includes("resident") || lower.includes("flat owner")) {
        pushSystemMessage("Opening resident directory records...", "residentDirectory");
      } else if (lower.includes("triage") || lower.includes("complaints queue") || lower.includes("open complaints")) {
        pushSystemMessage("Retrieving open complaint tickets triage queue...", "complaintTriage");
      } else if (lower.includes("compose") || lower.includes("post") || lower.includes("announcement") || lower.includes("notice")) {
        pushSystemMessage("Initializing announcement composer draft...", "announcementCompose");
      } else if (lower.includes("schedule") || lower.includes("bookings") || lower.includes("reservations")) {
        pushSystemMessage("Retrieving all active society reservations...", "bookingsSchedule");
      } else {
        pushSystemMessage(`Command '${text}' processed.`);
      }
      return;
    }

    if (userRole === "SECURITY_GUARD") {
      if (lower.includes("verify") || lower.includes("check pass") || lower.includes("check-in") || lower.includes("visitor")) {
        pushSystemMessage("Opening gate visitor verification console...", "verifyPass");
      } else if (lower.includes("sos") || lower.includes("alert") || lower.includes("alarm") || lower.includes("emergency")) {
        pushSystemMessage("Retrieving active emergency SOS logs...", "sosInbox");
      } else {
        pushSystemMessage(`Command '${text}' processed.`);
      }
      return;
    }

    if (userRole === "MAINTENANCE_STAFF") {
      if (lower.includes("task") || lower.includes("queue") || lower.includes("work order") || lower.includes("my jobs")) {
        pushSystemMessage("Opening assigned staff work orders...", "staffTasks");
      } else {
        pushSystemMessage(`Command '${text}' processed.`);
      }
      return;
    }

    if (userRole === "NON_RESIDENT_OWNER") {
      if (lower.includes("status") || lower.includes("occupancy") || lower.includes("property") || lower.includes("tenant")) {
        pushSystemMessage("Opening property details and tenant roster...", "propertyStatus");
      } else if (lower.includes("pass") || lower.includes("guest") || lower.includes("visitor")) {
        pushSystemMessage("Preparing digital visitor pass generation card...", "guestpass");
      } else if (lower.includes("announcement") || lower.includes("notice") || lower.includes("feed")) {
        pushSystemMessage("Retrieving recent society announcements...", "announcements");
      } else if (lower.includes("due") || lower.includes("bill") || lower.includes("invoice") || lower.includes("pay")) {
        pushSystemMessage("Fetching remote property accounts dues...", "dues");
      } else {
        pushSystemMessage(`Command '${text}' processed.`);
      }
      return;
    }

    // Default RESIDENT_OWNER
    if (
      (lower.includes("cancel") && (lower.includes("book") || lower.includes("slot") || lower.includes("reserve"))) ||
      lower.includes("my bookings") ||
      lower.includes("show bookings")
    ) {
      pushSystemMessage("Retrieving your active facility bookings...", "mybookings");
    } else if (lower.includes("book") || lower.includes("facility") || lower.includes("clubhouse") || lower.includes("gym")) {
      pushSystemMessage("Opening facility slot scheduler details...", "booking");
    } else if (lower.includes("complaint") || lower.includes("report") || lower.includes("issue") || lower.includes("leak")) {
      pushSystemMessage("Initializing society maintenance ticket draft...", "complaint");
    } else if (lower.includes("guest") || lower.includes("visitor") || lower.includes("pass")) {
      pushSystemMessage("Preparing digital visitor pass generation card...", "guestpass");
    } else if (lower.includes("announcement") || lower.includes("notice") || lower.includes("feed")) {
      pushSystemMessage("Retrieving recent society announcements...", "announcements");
    } else if (lower.includes("due") || lower.includes("bill") || lower.includes("invoice") || lower.includes("pay")) {
      pushSystemMessage("Fetching outstanding maintenance accounts...", "dues");
    } else if (lower.includes("sos") || lower.includes("emergency")) {
      pushSystemMessage("WARNING: Security SOS console triggered.", "sos");
    } else {
      pushSystemMessage(`I received: '${text}'. How can I help you today?`);
    }
  }


  // --- Interactive Form Cards ---

  // 1. Booking Form Card
  function BookingCard() {
    const [facilityName, setFacilityName] = useState(facilities[0].name);
    const [date, setDate] = useState("2026-07-15");
    const [slot, setSlot] = useState(timeSlots[0]);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [bookingId, setBookingId] = useState("");

    const takenSet = new Set(bookings.map((b) => `${b.facility}|${b.date}|${b.slot}`));
    const isSlotTaken = takenSet.has(`${facilityName}|${date}|${slot}`);

    const handleConfirm = () => {
      if (isSlotTaken) return;
      const newId = `BK-${Math.floor(500 + Math.random() * 500)}`;
      bookings.unshift({
        id: newId,
        facility: facilityName,
        date,
        slot,
        bookedBy: user?.name || "Resident",
        flatNo: user?.flatNo || "N/A",
      });
      setBookingId(newId);
      setIsConfirmed(true);
      notifyMockDataChanged();
    };

    return (
      <div className="bp-card p-4 my-2 border-signal/20 bg-blueprint-800/90 text-xs">
        <p className="bp-eyebrow mb-2">SCHEDULER WIDGET</p>
        {isConfirmed ? (
          <div className="space-y-1.5">
            <p className="text-emerald-400 font-semibold uppercase tracking-wider">✓ Slot Booked Successfully</p>
            <p className="text-ink-100 font-mono text-[11px]">ID: {bookingId}</p>
            <p className="text-ink-300">
              {facilityName} · {date} · {slot}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label-field text-[10px]">Amenity</label>
              <select
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                className="input-field py-1 text-xs"
              >
                {facilities.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-field text-[10px]">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field py-1 text-xs"
                />
              </div>
              <div>
                <label className="label-field text-[10px]">Time Slot</label>
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  className="input-field py-1 text-xs"
                >
                  {timeSlots.map((ts) => (
                    <option key={ts} value={ts}>
                      {ts}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between">
              <span className="text-[10px] text-ink-500 font-mono">
                {isSlotTaken ? "🔴 Slot Booked" : "🟢 Slot Available"}
              </span>
              <button
                onClick={handleConfirm}
                disabled={isSlotTaken}
                className="btn-primary py-1 px-3 text-xs"
              >
                Book Slot
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Complaint Form Card
  function ComplaintCard() {
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("Plumbing");
    const [description, setDescription] = useState("");
    const [urgency, setUrgency] = useState<"LOW" | "MEDIUM" | "URGENT">("MEDIUM");
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [complaintId, setComplaintId] = useState("");

    const handleSubmit = async () => {
      if (!title || !description) return;
      let newId = `CMP-${Math.floor(1000 + Math.random() * 50)}`;
      let backendId: string | undefined;

      try {
        const res: any = await api.post("/v1/complaints", {
          title: title.trim(),
          description: description.trim(),
          category,
          urgency: urgency === "URGENT" ? "HIGH" : urgency,
        });
        // apiFetch returns the parsed JSON body directly — not wrapped in { data: ... }
        if (res?.id) {
          newId = res.id;
          backendId = res.id;
        }
      } catch {
        // Fallback to local store if offline
      }

      complaints.unshift({
        id: newId,
        title,
        category,
        raisedBy: user?.name || "Resident",
        raisedById: backendId ?? (user?.id || undefined),
        flatNo: user?.flatNo || "B-304",
        status: "OPEN",
        urgency,
        createdAt: new Date().toISOString().split("T")[0],
        description,
        timeline: [{ label: "Complaint raised via Meridian AI", date: "Just now" }],
      });
      setComplaintId(newId);
      setIsSubmitted(true);
      notifyMockDataChanged();
    };

    return (
      <div className="bp-card p-4 my-2 border-signal/20 bg-blueprint-800/90 text-xs">
        <p className="bp-eyebrow mb-2">COMPLAINT TICKET DRAFT</p>
        {isSubmitted ? (
          <div className="space-y-1.5">
            <p className="text-signal font-semibold uppercase tracking-wider">✓ Ticket Raised Successfully</p>
            <p className="text-ink-100 font-mono text-[11px]">ID: {complaintId}</p>
            <p className="text-ink-300">
              {title} ({category}) · Urgency: {urgency}
            </p>
            <p className="text-[10px] text-ink-500 font-mono">Assigned to triage. View complaints list to track progress.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label-field text-[10px]">Brief Summary</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field py-1 text-xs"
                placeholder="e.g. Corridor light flickering"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-field text-[10px]">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field py-1 text-xs"
                >
                  <option>Plumbing</option>
                  <option>Electrical/Mechanical</option>
                  <option>Common Area</option>
                  <option>Security</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="label-field text-[10px]">Urgency</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as any)}
                  className="input-field py-1 text-xs"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label-field text-[10px]">Detailed Description</label>
              <textarea
                required
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field py-1 text-xs"
                placeholder="Please describe in detail..."
              />
            </div>
            <div className="text-right">
              <button
                onClick={handleSubmit}
                disabled={!title || !description}
                className="btn-primary py-1 px-3 text-xs disabled:opacity-50"
              >
                Submit Ticket
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Guest Pass Form Card
  function GuestPassCard() {
    const [guestName, setGuestName] = useState("");
    const [purpose, setPurpose] = useState("Personal visit");
    const [date, setDate] = useState("2026-07-15");
    const [isGenerated, setIsGenerated] = useState(false);
    const [passId, setPassId] = useState("");

    const handleGenerate = () => {
      if (!guestName) return;
      const newId = `GP-${Math.floor(2200 + Math.random() * 50)}`;
      guestPasses.unshift({
        id: newId,
        guestName,
        purpose,
        validOn: date,
        flatNo: user?.flatNo || "N/A",
        status: "ACTIVE",
      });
      setPassId(newId);
      setIsGenerated(true);
      notifyMockDataChanged();
    };

    return (
      <div className="bp-card p-4 my-2 border-signal/20 bg-blueprint-800/90 text-xs">
        <p className="bp-eyebrow mb-2">VISITOR DIGIPASS DRAFT</p>
        {isGenerated ? (
          <div className="text-center space-y-2">
            <p className="text-emerald-400 font-semibold uppercase tracking-wider">✓ Pass Generated Successfully</p>
            <MiniQR seed={passId} />
            <p className="text-ink-100 font-mono text-[11px]">{passId}</p>
            <p className="text-ink-300 font-medium">Guest: {guestName}</p>
            <p className="text-[10px] text-ink-500 font-mono">Valid on {date} · {purpose}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label-field text-[10px]">Guest Full Name</label>
              <input
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="input-field py-1 text-xs"
                placeholder="Visitor's name"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-field text-[10px]">Purpose</label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="input-field py-1 text-xs"
                >
                  <option>Personal visit</option>
                  <option>Delivery</option>
                  <option>Cab/Taxi</option>
                  <option>Service provider</option>
                </select>
              </div>
              <div>
                <label className="label-field text-[10px]">Valid On</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field py-1 text-xs"
                />
              </div>
            </div>
            <div className="text-right">
              <button
                onClick={handleGenerate}
                disabled={!guestName}
                className="btn-primary py-1 px-3 text-xs disabled:opacity-50"
              >
                Generate Pass
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. Announcements List Card
  function AnnouncementsCard() {
    return (
      <div className="space-y-2 my-2">
        <p className="bp-eyebrow mb-1">CENTRAL NOTICE FEED</p>
        {announcements.slice(0, 3).map((a) => (
          <div key={a.id} className="bp-card p-3 bg-blueprint-800/80 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <p className="font-semibold text-ink-100">{a.title}</p>
              <span className="text-[10px] font-mono text-ink-500">{a.postedAt}</span>
            </div>
            <p className="text-ink-300 leading-normal mb-1">{a.body}</p>
            <p className="text-[10px] text-ink-500 font-mono">— {a.postedBy}</p>
          </div>
        ))}
      </div>
    );
  }

  // 5. Invoices Dues Card
  function DuesCard() {
    const [invoiceList, setInvoiceList] = useState([...invoices]);

    const handlePay = (id: string) => {
      const inv = invoices.find((i) => i.id === id);
      if (inv) {
        inv.status = "PAID";
        setInvoiceList([...invoices]);
        notifyMockDataChanged();
      }
    };

    return (
      <div className="space-y-2 my-2">
        <p className="bp-eyebrow mb-1">OUTSTANDING INVOICES</p>
        {invoiceList.filter((i) => i.status !== "PAID").length === 0 ? (
          <div className="bp-card p-4 bg-blueprint-800/80 text-center">
            <p className="text-emerald-400 font-medium">✓ ALL CLEAR</p>
            <p className="text-ink-300 text-[11px] mt-1">No outstanding dues pending.</p>
          </div>
        ) : (
          invoiceList
            .filter((i) => i.status !== "PAID")
            .map((inv) => (
              <div key={inv.id} className="bp-card p-3 bg-blueprint-800/80 text-xs flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-ink-100 font-semibold">{inv.month}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded-xs ${
                        inv.status === "OVERDUE"
                          ? "bg-red-500/15 text-red-400"
                          : "bg-blueprint-700 text-ink-300"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-ink-500 font-mono mt-1">
                    ID: {inv.id} · Due: {inv.dueDate}
                  </p>
                  <p className="text-signal font-semibold font-mono mt-1 text-[13px]">₹{inv.amount}</p>
                </div>
                <button
                  onClick={() => handlePay(inv.id)}
                  className="btn-primary py-1 px-3 text-xs"
                >
                  Pay Now
                </button>
              </div>
            ))
        )}
      </div>
    );
  }

  // 6. SOS Confirmation Card
  function SosCard() {
    return (
      <div className="bp-card p-4 my-2 border-red-500/30 bg-red-950/20 text-xs">
        <p className="bp-eyebrow text-red-400 mb-2">⚠ EMERGENCY CONSOLE</p>
        <p className="text-ink-100 mb-1 font-semibold">SOS Alert Dispatched</p>
        <p className="text-ink-300 mb-3 leading-relaxed">
          An emergency ping has been broad-casted to the main guard station inbox with flat location:{" "}
          <strong className="text-red-400">{user?.flatNo || "N/A"}</strong>.
        </p>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
          <span className="text-[10px] text-ink-500 font-mono">STATUS: GUARD ALERTEES DISPATCHED</span>
        </div>
      </div>
    );
  }

  // 7. My Bookings / Cancellation Card
  function MyBookingsCard() {
    const [myBookings, setMyBookings] = useState([...bookings]);

    const handleCancel = (id: string) => {
      const idx = bookings.findIndex((b) => b.id === id);
      if (idx !== -1) {
        bookings.splice(idx, 1);
        setMyBookings([...bookings]);
        notifyMockDataChanged();
      }
    };

    return (
      <div className="space-y-2 my-2">
        <p className="bp-eyebrow mb-1">ACTIVE RESERVATIONS</p>
        {myBookings.length === 0 ? (
          <div className="bp-card p-4 bg-blueprint-800/80 text-center">
            <p className="text-emerald-400 font-medium">NO ACTIVE BOOKINGS</p>
            <p className="text-ink-300 text-[11px] mt-1">You don't have any upcoming reservations.</p>
          </div>
        ) : (
          myBookings.map((b) => (
            <div key={b.id} className="bp-card p-3 bg-blueprint-800/80 text-xs flex justify-between items-center">
              <div>
                <p className="font-semibold text-ink-100">{b.facility}</p>
                <p className="text-[10px] text-ink-500 font-mono mt-0.5">
                  ID: {b.id}
                </p>
                <p className="text-ink-300 font-mono mt-1 text-[11px]">
                  {b.date} · {b.slot}
                </p>
              </div>
              <button
                onClick={() => handleCancel(b.id)}
                className="btn-secondary py-1 px-2.5 text-xs border-red-500/30 text-red-400 hover:border-red-400 hover:text-red-300"
              >
                Cancel
              </button>
            </div>
          ))
        )}
      </div>
    );
  }

  // --- ROLE-SPECIFIC WIDGETS ---

  // 8. Management: Resident Directory Card
  function ResidentDirectoryCard() {
    const [filterPending, setFilterPending] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newFlatNo, setNewFlatNo] = useState("E-401");
    const [newRole, setNewRole] = useState<"OWNER" | "TENANT">("OWNER");
    const [statusMsg, setStatusMsg] = useState("");

    const displayedResidents = filterPending
      ? residents.filter((r) => r.duesStatus === "PENDING")
      : residents;

    const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newName || !newEmail) return;

      try {
        await api.post("/v1/users", {
          email: newEmail,
          password: "Password123",
          full_name: newName,
          phone: newPhone || "9800000099",
          role: newRole === "OWNER" ? "RESIDENT_OWNER" : "RESIDENT_OWNER",
        });
      } catch {
        // Continue and update local state even if backend offline
      }

      residents.unshift({
        flatNo: newFlatNo,
        name: newName,
        email: newEmail,
        type: newRole,
        contact: newPhone || "9800000099",
        duesStatus: "CLEAR",
      });
      notifyMockDataChanged();

      setStatusMsg(`✓ User '${newName}' (${newEmail}) added to database.`);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setShowAddForm(false);
    };

    return (
      <div className="bp-card p-4 my-2 bg-blueprint-800/90 text-xs space-y-3">
        <div className="flex justify-between items-center">
          <p className="bp-eyebrow">RESIDENT RECORDS</p>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary py-0.5 px-2 text-[10px]"
          >
            {showAddForm ? "Cancel" : "+ Add User"}
          </button>
        </div>

        {statusMsg && (
          <p className="text-emerald-400 font-mono text-[10px] bg-emerald-950/40 p-1.5 rounded-xs">
            {statusMsg}
          </p>
        )}

        {showAddForm && (
          <form onSubmit={handleAddUser} className="space-y-2 border border-signal/30 p-2.5 rounded-xs bg-blueprint-950/70">
            <p className="text-signal font-semibold text-[11px] uppercase">Onboard New User via Email</p>
            <div>
              <label className="label-field text-[9px]">Full Name</label>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input-field py-1 text-xs"
                placeholder="e.g. Ananya Roy"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-field text-[9px]">Email Address (Required)</label>
                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="input-field py-1 text-xs"
                  placeholder="ananya@example.com"
                />
              </div>
              <div>
                <label className="label-field text-[9px]">Phone</label>
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="input-field py-1 text-xs"
                  placeholder="9800000099"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-field text-[9px]">Flat No</label>
                <input
                  value={newFlatNo}
                  onChange={(e) => setNewFlatNo(e.target.value)}
                  className="input-field py-1 text-xs"
                  placeholder="E-401"
                />
              </div>
              <div>
                <label className="label-field text-[9px]">Occupancy Type</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="input-field py-1 text-xs"
                >
                  <option value="OWNER">Owner</option>
                  <option value="TENANT">Tenant</option>
                </select>
              </div>
            </div>
            <div className="text-right pt-1">
              <button type="submit" className="btn-primary py-1 px-3 text-xs">
                Create User Record
              </button>
            </div>
          </form>
        )}

        <div className="flex justify-between items-center">
          <span className="text-[10px] text-ink-500 font-mono">Count: {displayedResidents.length}</span>
          <button
            onClick={() => setFilterPending(!filterPending)}
            className={`px-2 py-0.5 rounded-xs border text-[10px] transition ${
              filterPending
                ? "border-signal text-signal bg-signal/10"
                : "border-blueprint-600 text-ink-300 hover:text-ink-100"
            }`}
          >
            {filterPending ? "Show All" : "Filter: Unpaid Dues"}
          </button>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {displayedResidents.map((r) => (
            <div key={r.flatNo + r.email} className="p-2 border border-blueprint-700 bg-blueprint-900/60 rounded-xs flex justify-between items-center">
              <div>
                <p className="font-semibold text-ink-100">{r.name} ({r.flatNo})</p>
                <p className="text-[10px] text-ink-300 font-mono">✉ {r.email || "N/A"}</p>
                <p className="text-[10px] text-ink-500 font-mono">Mob: {r.contact} · {r.type}</p>
              </div>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded-xs ${
                  r.duesStatus === "PENDING"
                    ? "bg-red-500/15 text-red-400 font-bold"
                    : "bg-emerald-500/15 text-emerald-400"
                }`}
              >
                {r.duesStatus === "PENDING" ? "UNPAID" : "PAID"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }



  // 9. Management: Complaint Triage Card
  function ComplaintTriageCard() {
    const [triageComplaints, setTriageComplaints] = useState([...complaints]);

    const handleAction = (id: string, newStatus: "IN_PROGRESS" | "RESOLVED") => {
      const cmp = complaints.find((c) => c.id === id);
      if (cmp) {
        cmp.status = newStatus;
        cmp.timeline.unshift({
          label: `Status marked as ${newStatus} by Official via AI Chat`,
          date: "Just now",
        });
        setTriageComplaints([...complaints]);
        notifyMockDataChanged();
      }
    };

    return (
      <div className="space-y-2 my-2">
        <p className="bp-eyebrow mb-1">OFFICIAL TRIAGE WIDGET</p>
        {triageComplaints.filter((c) => c.status !== "RESOLVED").length === 0 ? (
          <div className="bp-card p-4 bg-blueprint-800/80 text-center text-xs">
            <p className="text-emerald-400 font-medium">✓ ALL COMPLAINTS RESOLVED</p>
            <p className="text-ink-300 text-[10px] mt-1 font-mono">No active issues in dispatcher triage queue.</p>
          </div>
        ) : (
          triageComplaints
            .filter((c) => c.status !== "RESOLVED")
            .map((c) => (
              <div key={c.id} className="bp-card p-3 bg-blueprint-800/85 text-xs">
                <div className="flex justify-between items-start mb-1.5">
                  <div>
                    <span className="text-[10px] font-mono text-ink-500 mr-2">{c.id}</span>
                    <span
                      className={`text-[9px] font-mono px-1 rounded-xs uppercase ${
                        c.urgency === "URGENT"
                          ? "bg-red-500/15 text-red-400"
                          : c.urgency === "MEDIUM"
                          ? "bg-signal/15 text-signal"
                          : "bg-blueprint-700 text-ink-300"
                      }`}
                    >
                      {c.urgency}
                    </span>
                  </div>
                  <span className="text-[10px] text-ink-500 font-mono">Flat {c.flatNo}</span>
                </div>
                <p className="font-semibold text-ink-100 truncate mb-1">{c.title}</p>
                <p className="text-[10px] text-ink-300 mb-3 line-clamp-1">{c.category}</p>
                <div className="flex justify-end gap-2">
                  {c.status === "OPEN" && (
                    <button
                      onClick={() => handleAction(c.id, "IN_PROGRESS")}
                      className="px-2 py-1 rounded-xs bg-blueprint-700 text-ink-100 border border-blueprint-600 hover:border-signal text-[10px]"
                    >
                      Start Work
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(c.id, "RESOLVED")}
                    className="px-2 py-1 rounded-xs bg-emerald-600 hover:bg-emerald-500 text-ink-100 text-[10px]"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))
        )}
      </div>
    );
  }

  // 10. Management: Announcement Composer Card
  function AnnouncementComposeCard() {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [isPosted, setIsPosted] = useState(false);

    const handlePost = () => {
      if (!title || !body) return;
      announcements.unshift({
        id: `ANN-${Math.floor(32 + Math.random() * 20)}`,
        title,
        body,
        postedBy: "Society Official",
        postedAt: "Just now",
      });
      setIsPosted(true);
      notifyMockDataChanged();
    };

    return (
      <div className="bp-card p-4 my-2 border-signal/20 bg-blueprint-800/90 text-xs">
        <p className="bp-eyebrow mb-2">NOTICE COMPOSER</p>
        {isPosted ? (
          <div className="space-y-1.5">
            <p className="text-signal font-semibold uppercase tracking-wider">✓ Announcement Broadcasted</p>
            <p className="text-ink-100 font-semibold">{title}</p>
            <p className="text-[10px] text-ink-500 font-mono">Dispatched to all resident news feeds.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label-field text-[10px]">Notice Title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field py-1 text-xs"
                placeholder="e.g. Lift maintenance scheduling"
              />
            </div>
            <div>
              <label className="label-field text-[10px]">Message Details</label>
              <textarea
                required
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="input-field py-1 text-xs"
                placeholder="Provide details about the notice..."
              />
            </div>
            <div className="text-right">
              <button
                onClick={handlePost}
                disabled={!title || !body}
                className="btn-primary py-1 px-3 text-xs disabled:opacity-50"
              >
                Broadcast Notice
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 11. Management: Bookings Schedule Card
  function BookingsScheduleCard() {
    return (
      <div className="space-y-2 my-2 max-h-56 overflow-y-auto pr-1">
        <p className="bp-eyebrow mb-1">CENTRAL BOOKING SCHEDULE</p>
        {bookings.map((b) => (
          <div key={b.id} className="bp-card p-3 bg-blueprint-800/80 text-xs flex justify-between items-start">
            <div>
              <p className="font-semibold text-ink-100">{b.facility}</p>
              <p className="text-[10px] text-ink-500 font-mono mt-0.5">
                ID: {b.id} · Flat: {b.flatNo} ({b.bookedBy})
              </p>
              <p className="text-ink-300 font-mono mt-1 text-[10px]">{b.date} · {b.slot}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 12. Non-Resident Owner: Property Status Card
  function PropertyStatusCard() {
    const flatNo = user?.flatNo || "B-304";
    const residentObj = residents.find((r) => r.flatNo === flatNo) || residents[1];

    return (
      <div className="bp-card p-4 my-2 bg-blueprint-800/90 text-xs">
        <p className="bp-eyebrow mb-2">PROPERTY SPECIFICATIONS</p>
        <div className="space-y-2">
          <div className="grid grid-cols-2 border-b border-blueprint-700 pb-1.5">
            <span className="text-ink-500 font-mono">Flat Code</span>
            <span className="text-ink-100 font-semibold text-right">{flatNo}</span>
          </div>
          <div className="grid grid-cols-2 border-b border-blueprint-700 pb-1.5">
            <span className="text-ink-500 font-mono">Tenant Name</span>
            <span className="text-ink-100 font-semibold text-right">{residentObj.name}</span>
          </div>
          <div className="grid grid-cols-2 border-b border-blueprint-700 pb-1.5">
            <span className="text-ink-500 font-mono">Tenant Type</span>
            <span className="text-ink-100 font-semibold text-right">{residentObj.type}</span>
          </div>
          <div className="grid grid-cols-2 border-b border-blueprint-700 pb-1.5">
            <span className="text-ink-500 font-mono">Contact Info</span>
            <span className="text-ink-100 font-semibold text-right">{residentObj.contact}</span>
          </div>
          <div className="grid grid-cols-2 pt-0.5">
            <span className="text-ink-500 font-mono">Dues Status</span>
            <span
              className={`text-right font-bold font-mono ${
                residentObj.duesStatus === "PENDING" ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {residentObj.duesStatus === "PENDING" ? "UNPAID BILLS" : "ALL CLEAR"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 13. Security Guard: Verify Pass Card
  function VerifyPassCard() {
    const [searchId, setSearchId] = useState("");
    const [foundPass, setFoundPass] = useState<typeof guestPasses[0] | null>(null);
    const [searched, setSearched] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");

    const handleSearch = () => {
      setSearched(true);
      const pass = guestPasses.find((gp) => gp.id.toUpperCase() === searchId.trim().toUpperCase());
      if (pass) {
        setFoundPass(pass);
        setStatusMessage("");
      } else {
        setFoundPass(null);
        setStatusMessage("Pass not found in system directory.");
      }
    };

    const handleCheckIn = (id: string) => {
      const pass = guestPasses.find((gp) => gp.id === id);
      if (pass) {
        pass.status = "USED";
        setFoundPass({ ...pass });
        notifyMockDataChanged();
      }
    };

    return (
      <div className="bp-card p-4 my-2 border-signal/20 bg-blueprint-800/90 text-xs">
        <p className="bp-eyebrow mb-2">GATE MONITOR</p>
        <div className="flex gap-2 mb-3">
          <input
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="input-field py-1 text-xs"
            placeholder="Enter pass ID (e.g. GP-2201)"
          />
          <button onClick={handleSearch} className="btn-primary py-1 px-3 text-xs">
            Verify
          </button>
        </div>

        {searched && (
          <div className="border-t border-blueprint-700 pt-2.5 space-y-2">
            {foundPass ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-ink-100 font-semibold">{foundPass.id}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded-xs ${
                      foundPass.status === "ACTIVE"
                        ? "bg-emerald-500/15 text-emerald-400 font-bold"
                        : foundPass.status === "USED"
                        ? "bg-blueprint-700 text-ink-500"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {foundPass.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-ink-100 font-medium">Guest: {foundPass.guestName}</p>
                  <p className="text-[10px] text-ink-300">
                    Flat Destination: {foundPass.flatNo}
                  </p>
                  <p className="text-[10px] text-ink-500 font-mono">
                    Valid: {foundPass.validOn} · Purpose: {foundPass.purpose}
                  </p>
                </div>

                {foundPass.status === "ACTIVE" && (
                  <button
                    onClick={() => handleCheckIn(foundPass.id)}
                    className="w-full btn-primary py-1 text-xs mt-1"
                  >
                    Check-In Visitor & Void Pass
                  </button>
                )}
              </div>
            ) : (
              <p className="text-red-400 text-center font-mono text-[10px] py-1">{statusMessage}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // 14. Security Guard: SOS Alerts Inbox Card
  function SosInboxCard() {
    const [alerts, setAlerts] = useState([...sosAlerts]);

    const handleAcknowledge = (id: string) => {
      const alert = sosAlerts.find((s) => s.id === id);
      if (alert) {
        alert.status = "ACKNOWLEDGED";
        setAlerts([...sosAlerts]);
        notifyMockDataChanged();
      }
    };

    return (
      <div className="space-y-2 my-2">
        <p className="bp-eyebrow text-red-400 mb-1">EMERGENCY ALARMS</p>
        {alerts.length === 0 ? (
          <div className="bp-card p-4 bg-blueprint-800/80 text-center text-xs">
            <p className="text-emerald-400 font-medium">✓ SECURITY STATUS SECURE</p>
            <p className="text-ink-300 text-[10px] mt-1 font-mono">No active emergency SOS triggers received.</p>
          </div>
        ) : (
          alerts.map((al) => (
            <div
              key={al.id}
              className={`bp-card p-3 text-xs flex justify-between items-center ${
                al.status === "ACTIVE"
                  ? "border-red-500 bg-red-950/20"
                  : "border-blueprint-700 bg-blueprint-800/80"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-ink-100 font-bold">{al.id}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded-xs ${
                      al.status === "ACTIVE"
                        ? "bg-red-500 text-ink-100 font-bold animate-pulse"
                        : "bg-blueprint-700 text-ink-500"
                    }`}
                  >
                    {al.status}
                  </span>
                </div>
                <p className="text-ink-100 font-semibold mt-1">Location: Flat {al.flatNo}</p>
                <p className="text-[9px] text-ink-500 font-mono mt-0.5">Raised: {al.raisedAt}</p>
              </div>
              {al.status === "ACTIVE" && (
                <button
                  onClick={() => handleAcknowledge(al.id)}
                  className="px-2 py-1 rounded-xs bg-red-600 hover:bg-red-500 text-ink-100 text-[10px] font-semibold"
                >
                  Ack Alarm
                </button>
              )}
            </div>
          ))
        )}
      </div>
    );
  }

  // 15. Maintenance Staff: Tasks Card
  function StaffTasksCard() {
    const [tasksList, setTasksList] = useState([...staffTasks]);

    const handleCycle = (id: string, nextStatus: "IN_PROGRESS" | "DONE") => {
      const task = staffTasks.find((t) => t.id === id);
      if (task) {
        task.status = nextStatus;
        setTasksList([...staffTasks]);
        notifyMockDataChanged();
      }
    };

    return (
      <div className="space-y-2 my-2">
        <p className="bp-eyebrow mb-1">ASSIGNED WORK ORDERS</p>
        {tasksList.filter((t) => t.status !== "DONE").length === 0 ? (
          <div className="bp-card p-4 bg-blueprint-800/80 text-center text-xs">
            <p className="text-emerald-400 font-medium">✓ WORK ORDERS COMPLETE</p>
            <p className="text-ink-300 text-[10px] mt-1 font-mono">No pending maintenance jobs on roster queue.</p>
          </div>
        ) : (
          tasksList
            .filter((t) => t.status !== "DONE")
            .map((t) => (
              <div key={t.id} className="bp-card p-3 bg-blueprint-800/85 text-xs">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <span className="font-mono text-ink-500 mr-2">{t.id}</span>
                    <span
                      className={`text-[9px] font-mono px-1 rounded-xs uppercase ${
                        t.status === "IN_PROGRESS"
                          ? "bg-signal/15 text-signal font-bold"
                          : "bg-blueprint-700 text-ink-300"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-ink-500 font-mono">Due: {t.dueBy}</span>
                </div>
                <p className="font-semibold text-ink-100 mb-1">{t.task}</p>
                <p className="text-[10px] text-ink-300 mb-3 font-mono">Loc: {t.location}</p>
                <div className="flex justify-end gap-2">
                  {t.status === "PENDING" ? (
                    <button
                      onClick={() => handleCycle(t.id, "IN_PROGRESS")}
                      className="px-2 py-1 rounded-xs bg-blueprint-700 text-ink-100 border border-blueprint-600 hover:border-signal text-[10px]"
                    >
                      Start Task
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCycle(t.id, "DONE")}
                      className="px-2 py-1 rounded-xs bg-emerald-600 hover:bg-emerald-500 text-ink-100 text-[10px]"
                    >
                      Complete Task
                    </button>
                  )}
                </div>
              </div>
            ))
        )}
      </div>
    );
  }

  // Render cards based on type
  function renderCard(type?: Message["cardType"]) {
    switch (type) {
      case "booking":
        return <BookingCard />;
      case "complaint":
        return <ComplaintCard />;
      case "guestpass":
        return <GuestPassCard />;
      case "announcements":
        return <AnnouncementsCard />;
      case "dues":
        return <DuesCard />;
      case "sos":
        return <SosCard />;
      case "mybookings":
        return <MyBookingsCard />;
      case "residentDirectory":
        return <ResidentDirectoryCard />;
      case "complaintTriage":
        return <ComplaintTriageCard />;
      case "announcementCompose":
        return <AnnouncementComposeCard />;
      case "bookingsSchedule":
        return <BookingsScheduleCard />;
      case "propertyStatus":
        return <PropertyStatusCard />;
      case "verifyPass":
        return <VerifyPassCard />;
      case "sosInbox":
        return <SosInboxCard />;
      case "staffTasks":
        return <StaffTasksCard />;
      default:
        return null;
    }
  }

  // Dynamic quick-action suggester chips based on user role
  function renderChips() {
    switch (user?.role) {
      case "SOCIETY_OFFICIAL":
        return (
          <>
            <button
              onClick={() => handleSend("Show Resident Directory")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [📋 Directory]
            </button>
            <button
              onClick={() => handleSend("Triage Complaints")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [⚙ Triage]
            </button>
            <button
              onClick={() => handleSend("Post Announcement")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [✉ Compose]
            </button>
            <button
              onClick={() => handleSend("Show Bookings Schedule")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [📅 Schedule]
            </button>
          </>
        );
      case "NON_RESIDENT_OWNER":
        return (
          <>
            <button
              onClick={() => handleSend("Check Property Status")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [🏡 Property]
            </button>
            <button
              onClick={() => handleSend("Generate Guest Pass")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [→ Guest]
            </button>
            <button
              onClick={() => handleSend("View Notices")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [i Notice]
            </button>
            <button
              onClick={() => handleSend("Check Dues")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [$ Dues]
            </button>
          </>
        );
      case "SECURITY_GUARD":
        return (
          <>
            <button
              onClick={() => handleSend("Verify Guest Pass")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [✓ Verify]
            </button>
            <button
              onClick={() => handleSend("Show SOS Alerts")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-red-950/40 text-red-400 bg-blueprint-900/60 hover:border-red-500 hover:text-red-300 transition"
            >
              [🚨 SOS Alerts]
            </button>
          </>
        );
      case "MAINTENANCE_STAFF":
        return (
          <>
            <button
              onClick={() => handleSend("Show My Tasks")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [🔧 My Tasks]
            </button>
          </>
        );
      case "RESIDENT_OWNER":
      default:
        return (
          <>
            <button
              onClick={() => handleSend("Book Facility")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [+ Book]
            </button>
            <button
              onClick={() => handleSend("Raise Complaint")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [! Complaint]
            </button>
            <button
              onClick={() => handleSend("Generate Guest Pass")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [→ Guest]
            </button>
            <button
              onClick={() => handleSend("Announcements")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [i Notice]
            </button>
            <button
              onClick={() => handleSend("Check Dues")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-blueprint-700 text-ink-300 bg-blueprint-900/60 hover:border-signal hover:text-signal transition"
            >
              [$ Dues]
            </button>
            <button
              onClick={() => handleSend("Trigger SOS")}
              className="font-mono text-[10px] tracking-wide uppercase px-2 py-1 rounded-xs border border-red-900/55 text-red-400 bg-red-950/10 hover:border-red-500 hover:text-red-300 transition"
            >
              [⚠ SOS]
            </button>
          </>
        );
    }
  }

  return (
    <>
      {/* Floating Trigger Button in Top Right Corner */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-5 right-5 z-40 flex items-center gap-2 rounded-sm border border-blueprint-600 bg-blueprint-950/90 px-3.5 py-2 text-xs font-medium text-ink-100 hover:border-signal hover:text-signal transition-all duration-200 shadow-xl active:scale-95"
      >
        <span className="font-mono text-[10px] text-signal font-bold uppercase tracking-wider">AI-01</span>
        <span>Meridian AI</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
      </button>

      {/* Slide-Out Drawer Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Click Closes Drawer */}
          <div
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-blueprint-950/40 backdrop-blur-xs transition-opacity duration-200"
          ></div>

          {/* Panel Content with grid background */}
          <div className="relative w-[400px] h-full bg-blueprint-900 border-l border-blueprint-700 shadow-2xl flex flex-col z-10 transition-transform duration-300 ease-out transform translate-x-0 bp-canvas">
            {/* Corner Drafting Lines */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-blueprint-500"></div>
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-blueprint-500"></div>

            {/* Header */}
            <div className="px-5 py-4 border-b border-blueprint-700 flex items-center justify-between bg-blueprint-950/60">
              <div>
                <p className="bp-eyebrow">SYS-BOT / INTERACTION</p>
                <h3 className="font-display font-semibold text-base text-signal">Meridian AI Assistant</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-ink-500 hover:text-signal font-mono text-lg p-1 transition"
                title="Close"
              >
                [×]
              </button>
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 font-body">
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-mono text-ink-500">
                      {m.sender === "user" ? "USER" : "AI-SYSTEM"}
                    </span>
                    <span className="text-[9px] font-mono text-ink-600">
                      {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div
                    className={`rounded-sm px-3.5 py-2.5 max-w-[85%] text-xs leading-relaxed ${
                      m.sender === "user"
                        ? "bg-blueprint-700/80 border border-blueprint-600 text-ink-100 rounded-tr-none"
                        : "bg-blueprint-950/60 border border-blueprint-800 text-ink-300 rounded-tl-none font-body"
                    }`}
                    style={{ whiteSpace: "pre-line" }}
                  >
                    {m.text}
                  </div>
                  {m.cardType && <div className="w-[85%] mt-2 self-stretch">{renderCard(m.cardType)}</div>}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Suggester Chips */}
            <div className="px-5 pt-3 pb-1 flex flex-wrap gap-1.5 bg-blueprint-950/40 border-t border-blueprint-800">
              {renderChips()}
            </div>

            {/* Input Bar */}
            <div className="px-5 py-4 border-t border-blueprint-700 bg-blueprint-950/60">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <input
                  required
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask AI to book a slot, raise ticket..."
                  className="input-field flex-1 text-xs py-2 px-3 border-blueprint-600 bg-blueprint-950/80 focus:border-signal"
                />
                <button
                  type="submit"
                  className="btn-primary px-3 text-xs flex items-center justify-center font-bold"
                  title="Send message"
                >
                  ↵
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
