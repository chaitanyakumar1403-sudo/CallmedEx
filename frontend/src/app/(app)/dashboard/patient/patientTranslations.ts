export type PatientLang = 'en' | 'te' | 'hi';

export interface PatientTranslations {
  welcome: string;
  greeting: string;
  bookTest: string;
  familyCaregiverSwitcher: string;
  members: string;
  noFamilyMembers: string;
  addFamilyHint: string;
  self: string;
  emergencySOSTriage: string;
  twentyFourSevenActive: string;
  sosAlertDesc: (count: number) => string;
  triggerEmergencySOS: string;
  dispatched: string;
  cancel: string;
  emergencySOSBtn: string;
  emergencyConfirm: string;
  preventiveBiomarkerMatrix: string;
  biomarkerSubtitle: string;
  riskCompass: string;
  timeSeriesTrend: string;
  noBiomarkersTitle: string;
  noBiomarkersBody: string;
  readingsOnFile: string;
  biomarkersCount: (count: number) => string;
  smartMedicineCabinet: string;
  medicineCabinetSubtitle: string;
  addMedication: string;
  noMedicationsTitle: string;
  noMedicationsBody: string;
  daysSupplyRemaining: string;
  pillsRemaining: string;
  refillNeeded: string;
  dailyDosage: string;
  reorderMeds: string;
  sampleStatusTitle: string;
  sampleSteps: {
    pending: string;
    collected: string;
    inTransit: string;
    verified: string;
    sentToLab: string;
  };
  actionChips: {
    aiVoice: string;
    drugShield: string;
    phleboDemo: string;
    phleboHide: string;
    doctorBriefing: string;
  };
  rapido: {
    title: string;
    sampleData: string;
    searchingSubtitle: string;
    enRouteSubtitle: string;
    arrivedSubtitle: string;
    broadcastingBadge: string;
    enRouteBadge: string;
    arrivedBadge: string;
    callPhlebo: string;
    whatsapp: string;
    atDoorstep: string;
    minsAway: (mins: number) => string;
    kmAway: (km: number) => string;
    otpTitle: string;
    otpDesc: string;
    sterileSeal: string;
    steps: {
      confirmed: string;
      search: string;
      enRoute: string;
      arrived: string;
      inLab: string;
    };
    vaccinated: string;
    sterileKits: string;
    tempBox: string;
  };
  kpi: {
    upcoming: string;
    upcomingSub: string;
    completed: string;
    completedSub: string;
    prescriptions: string;
    prescriptionsSub: string;
    records: string;
    recordsSub: string;
  };
  allottedSlots: {
    title: string;
    pendingCount: (count: number) => string;
    timeAllotted: string;
    accept: string;
    decline: string;
  };
  quickActions: {
    title: string;
    subtitle: string;
    urgentHomeCollection: string;
    urgentHomeCollectionSub: string;
    urgentHomeCollectionTag: string;
    urgentHomeDoctor: string;
    urgentHomeDoctorSub: string;
    urgentHomeDoctorTag: string;
    urgentHomeNurse: string;
    urgentHomeNurseSub: string;
    urgentHomeNurseTag: string;
    urgentPharmacy: string;
    urgentPharmacySub: string;
    urgentPharmacyTag: string;
    homeDietitian: string;
    homeDietitianSub: string;
    homeDietitianTag: string;
    homePhysio: string;
    homePhysioSub: string;
    homePhysioTag: string;
    videoConsult: string;
    videoConsultSub: string;
    videoConsultTag: string;
    pmjay: string;
    pmjaySub: string;
    pmjayTag: string;
    aiReports: string;
    aiReportsSub: string;
    aiReportsTag: string;
    requesting: string;
  };
  bookings: {
    title: string;
    loading: string;
    noBookings: string;
    bookFirst: string;
    viewAllHistory: string;
    trackPhlebo: string;
    quickReorder: string;
    cancel: string;
  };
  abha: {
    title: string;
    linked: string;
    synced: string;
    notLinkedDesc: string;
    manageBtn: string;
  };
  reorderModal: {
    title: string;
    subtitle: string;
    estimatedPrice: string;
    cancel: string;
    confirm: string;
    processing: string;
  };
}

export const PATIENT_TRANSLATIONS: Record<PatientLang, PatientTranslations> = {
  en: {
    welcome: "Welcome",
    greeting: "Here's your health overview for today",
    bookTest: "Book a Service",
    familyCaregiverSwitcher: "Family Caregiver Switcher",
    members: "Members",
    noFamilyMembers: "No family members added yet. Add family members in the Family Members section below to switch profiles.",
    addFamilyHint: "Add family member",
    self: "Self",
    emergencySOSTriage: "Emergency SOS Triage",
    twentyFourSevenActive: "24/7 Active",
    sosAlertDesc: (count) => `Instant dispatch alert to ${count} emergency contacts & CallMedex unit with GPS.`,
    triggerEmergencySOS: "Trigger Emergency SOS",
    dispatched: "Dispatched!",
    cancel: "Cancel",
    emergencySOSBtn: "EMERGENCY SOS",
    emergencyConfirm: "EMERGENCY SOS ALERT: This will broadcast a high-priority beacon to nearby emergency doctors and ambulance services. Your current location will be shared. Continue?",
    preventiveBiomarkerMatrix: "Preventive Biomarker Matrix",
    biomarkerSubtitle: "Lab observations on file. Clinical risk interpretation requires doctor review.",
    riskCompass: "Risk Compass",
    timeSeriesTrend: "Time-Series Trend",
    noBiomarkersTitle: "No Lab Biomarkers Recorded Yet",
    noBiomarkersBody: "Book a diagnostic lab test to start building your biomarker history and trend view.",
    readingsOnFile: "Readings On File",
    biomarkersCount: (count) => `${count} biomarker(s)`,
    smartMedicineCabinet: "Smart Medicine Cabinet & Refill Radar",
    medicineCabinetSubtitle: "Track active prescription pills, daily dosages, and refill dates.",
    addMedication: "Add Medication",
    noMedicationsTitle: "No active medications in cabinet",
    noMedicationsBody: "Add your first prescription medication to track daily dosage reminders and refill dates.",
    daysSupplyRemaining: "Days Supply Remaining",
    pillsRemaining: "Pills Remaining",
    refillNeeded: "Refill Needed",
    dailyDosage: "Daily Dosage",
    reorderMeds: "Re-Order All Active Prescriptions",
    sampleStatusTitle: "Track Sample Progress",
    sampleSteps: {
      pending: "Pending Collection",
      collected: "Collected",
      inTransit: "In Transit / Received",
      verified: "Verified",
      sentToLab: "Sent to Lab",
    },
    actionChips: {
      aiVoice: "AI Voice Scribe & Triage",
      drugShield: "DrugShield AI (80% Generic Savings)",
      phleboDemo: "Phlebo Dispatch (Demo)",
      phleboHide: "Hide Demo Tracker",
      doctorBriefing: "AI Doctor Briefing (PDF / QR)",
    },
    rapido: {
      title: "CallMedex Rapido Phlebo Dispatch",
      sampleData: "Sample data",
      searchingSubtitle: "Connecting with verified phlebotomists in your immediate delivery radius...",
      enRouteSubtitle: "Phlebotomist is en route with temperature-controlled cold chain sample kit.",
      arrivedSubtitle: "Phlebotomist is at your doorstep. Please share the sterile OTP to begin.",
      broadcastingBadge: "Broadcasting Request",
      enRouteBadge: "Phlebo En Route",
      arrivedBadge: "Arrived at Doorstep",
      callPhlebo: "Call Phlebo",
      whatsapp: "WhatsApp",
      atDoorstep: "At Your Doorstep",
      minsAway: (mins) => `~${mins} mins`,
      kmAway: (km) => `${km} km away`,
      otpTitle: "Share this OTP with Phlebotomist",
      otpDesc: "Share this secure code only when the phlebotomist arrives at your doorstep with sterile, tamper-evident vacutainer tubes.",
      sterileSeal: "Sterile Vacuum Seal Assured",
      steps: {
        confirmed: "Confirmed",
        search: "Phlebo Search",
        enRoute: "En Route",
        arrived: "Doorstep Arrival",
        inLab: "Sample in Lab",
      },
      vaccinated: "100% Vaccinated",
      sterileKits: "Sterile Single-Use Vacutainer Kits",
      tempBox: "2°C–8°C Temperature Monitored Box",
    },
    kpi: {
      upcoming: "Upcoming Appointments",
      upcomingSub: "Scheduled bookings",
      completed: "Completed Services",
      completedSub: "Lifetime care delivered",
      prescriptions: "Active Prescriptions",
      prescriptionsSub: "Routine medications",
      records: "Health Records",
      recordsSub: "Diagnostic lab reports",
    },
    allottedSlots: {
      title: "Slot Allotment Notifications",
      pendingCount: (count) => `${count} pending`,
      timeAllotted: "Time Slot Allotted",
      accept: "Accept",
      decline: "Decline",
    },
    quickActions: {
      title: "Quick Actions",
      subtitle: "Instant Doorstep Healthcare & Telemedicine",
      urgentHomeCollection: "Urgent Home Collection",
      urgentHomeCollectionSub: "Certified Phlebotomist at your doorstep in 15–30 mins.",
      urgentHomeCollectionTag: "Free Home Visit · NABL Lab",
      urgentHomeDoctor: "Urgent Home Doctor",
      urgentHomeDoctorSub: "MBBS / MD Physician physical examination & prescription.",
      urgentHomeDoctorTag: "Verified Physician",
      urgentHomeNurse: "Urgent Home Nurse",
      urgentHomeNurseSub: "IV drip, wound dressing, vitals check & post-op nursing.",
      urgentHomeNurseTag: "B.Sc Nursing Certified",
      urgentPharmacy: "Urgent Medicine Delivery",
      urgentPharmacySub: "Hyperlocal pharmacy delivery with 80% generic savings.",
      urgentPharmacyTag: "Under 45 Mins",
      homeDietitian: "Home Dietitian & Nutrition",
      homeDietitianSub: "Bedside nutritional audit, diabetes MNT & tailored diet chart.",
      homeDietitianTag: "IDA Certified · ₹800 Visit",
      homePhysio: "Home Physiotherapist",
      homePhysioSub: "Bedside joint mobilization, spine rehab & stroke recovery.",
      homePhysioTag: "MIAP Certified · ₹800 Visit",
      videoConsult: "Video Consultation",
      videoConsultSub: "Connect with specialist doctor in 60 seconds with AI summary.",
      videoConsultTag: "Instant HD Connect",
      pmjay: "AB-PMJAY Cashless",
      pmjaySub: "Government Ayushman Bharat ₹5 Lakh Cashless Coverage.",
      pmjayTag: "Zero Out-of-Pocket",
      aiReports: "AI Reports & Insights",
      aiReportsSub: "Instant plain-language translation of complex lab reports.",
      aiReportsTag: "NextGen Liquid AI",
      requesting: "Requesting...",
    },
    bookings: {
      title: "Recent Bookings",
      loading: "Loading...",
      noBookings: "No recent bookings found.",
      bookFirst: "Book Your First Service",
      viewAllHistory: "View All Bookings History",
      trackPhlebo: "Track Phlebo",
      quickReorder: "Quick Re-Order",
      cancel: "Cancel",
    },
    abha: {
      title: "ABHA Health Records",
      linked: "ABHA Linked:",
      synced: "Your health records are synced with ABDM.",
      notLinkedDesc: "Link your ABHA (Ayushman Bharat Health Account) to access your complete health history from any ABDM-registered facility.",
      manageBtn: "Manage ABHA Account",
    },
    reorderModal: {
      title: "Quick Re-Order Confirmation",
      subtitle: "Re-book your past test package or prescription order with 1 click:",
      estimatedPrice: "Estimated Price:",
      cancel: "Cancel",
      confirm: "Confirm & Re-Order",
      processing: "Processing...",
    },
  },

  te: {
    welcome: "స్వాగతం",
    greeting: "ఈ రోజు మీ ఆరోగ్య స్థూలదృష్టి ఇక్కడ ఉంది",
    bookTest: "సేవను బుక్ చేయండి",
    familyCaregiverSwitcher: "కుటుంబ సంరక్షకుల మార్పిడి",
    members: "సభ్యులు",
    noFamilyMembers: "ఇంకా కుటుంబ సభ్యులు జోడించబడలేదు. ప్రొఫైల్స్ మారడానికి దిగువన కుటుంబ సభ్యుల విభాగంలో జోడించండి.",
    addFamilyHint: "కుటుంబ సభ్యుడిని జోడించండి",
    self: "స్వీయ",
    emergencySOSTriage: "అత్యవసర SOS ట్రయాజ్",
    twentyFourSevenActive: "24/7 క్రియాశీలం",
    sosAlertDesc: (count) => `GPSతో ${count} అత్యవసర పరిచయాలు & కాల్‌మెడెక్స్ యూనిట్‌కు తక్షణ హెచ్చరిక.`,
    triggerEmergencySOS: "అత్యవసర SOS ప్రారంభించండి",
    dispatched: "పంపబడింది!",
    cancel: "రద్దు చేయండి",
    emergencySOSBtn: "అత్యవసర SOS",
    emergencyConfirm: "అత్యవసర SOS హెచ్చరిక: ఇది సమీపంలోని అత్యవసర వైద్యులు మరియు అంబులెన్స్ సేవలకు అధిక-ప్రాధాన్యత హెచ్చరికను ప్రసారం చేస్తుంది. మీ ప్రస్తుత లొకేషన్ పంచుకోబడుతుంది. కొనసాగించాలా?",
    preventiveBiomarkerMatrix: "నివారణ బయోమార్కర్ మాతృక",
    biomarkerSubtitle: "ఫైల్‌లోని ల్యాబ్ ఫలితాలు. క్లినికల్ రిస్క్ వివరణకు డాక్టర్ సమీక్ష అవసరం.",
    riskCompass: "రిస్క్ కంపాస్",
    timeSeriesTrend: "సమయ-శ్రేణి ట్రెండ్",
    noBiomarkersTitle: "ఇంకా ల్యాబ్ బయోమార్కర్‌లు నమోదు కాలేదు",
    noBiomarkersBody: "మీ బయోమార్కర్ చరిత్ర మరియు ట్రెండ్ వీక్షణను ప్రారంభించడానికి డయాగ్నస్టిక్ ల్యాబ్ టెస్ట్‌ను బుక్ చేయండి.",
    readingsOnFile: "ఫైల్‌లో రీడింగ్‌లు",
    biomarkersCount: (count) => `${count} బయోమార్కర్(లు)`,
    smartMedicineCabinet: "స్మార్ట్ మెడిసిన్ క్యాబినెట్ & రీఫిల్ రాడార్",
    medicineCabinetSubtitle: "క్రియాశీల ప్రిస్క్రిప్షన్ మాత్రలు, రోజువారీ మోతాదులు మరియు రీఫిల్ తేదీలను ట్రాక్ చేయండి.",
    addMedication: "మందును జోడించండి",
    noMedicationsTitle: "క్యాబినెట్‌లో మందులు లేవు",
    noMedicationsBody: "రోజువారీ మోతాదులు మరియు రీఫిల్ రిమైండర్లను ట్రాక్ చేయడానికి మీ మొదటి ప్రిస్క్రిప్షన్‌ను జోడించండి.",
    daysSupplyRemaining: "రోజుల నిల్వ మిగిలి ఉంది",
    pillsRemaining: "మాత్రలు మిగిలి ఉన్నాయి",
    refillNeeded: "రీఫిల్ అవసరం",
    dailyDosage: "రోజువారీ మోతాదు",
    reorderMeds: "అన్ని మందులను రీ-ఆర్డర్ చేయండి",
    sampleStatusTitle: "నమూనా పురోగతి ట్రాకింగ్",
    sampleSteps: {
      pending: "సేకరణ వేచి ఉంది",
      collected: "సేకరించబడింది",
      inTransit: "రవాణాలో ఉంది / అందింది",
      verified: "ధృవీకరించబడింది",
      sentToLab: "ల్యాబ్‌కు పంపబడింది",
    },
    actionChips: {
      aiVoice: "AI వాయిస్ స్క్రిబ్ & ట్రయాజ్",
      drugShield: "డ్రగ్‌షీల్డ్ AI (80% జెనరిక్ పొదుపు)",
      phleboDemo: "ఫ్లెబో డిస్పాచ్ (డెమో)",
      phleboHide: "డెమో ట్రాకర్‌ను దాచండి",
      doctorBriefing: "AI డాక్టర్ బ్రీఫింగ్ (PDF / QR)",
    },
    rapido: {
      title: "కాల్‌మెడెక్స్ రాపిడో ఫ్లెబో డిస్పాచ్",
      sampleData: "నమూనా సమాచారం",
      searchingSubtitle: "మీ డెలివరీ పరిధిలోని ధృవీకరించబడిన ఫ్లెబోటోమిస్ట్‌లను కనెక్ట్ చేస్తోంది...",
      enRouteSubtitle: "ఉష్ణోగ్రత-నియంత్రిత కోల్డ్ చైన్ నమూనా కిట్‌తో ఫ్లెబోటోమిస్ట్ వస్తున్నారు.",
      arrivedSubtitle: "ఫ్లెబోటోమిస్ట్ మీ ఇంటి వద్దకు చేరుకున్నారు. ప్రారంభించడానికి స్టెరైల్ OTPని పంచుకోండి.",
      broadcastingBadge: "అభ్యర్థన ప్రసారం అవుతోంది",
      enRouteBadge: "ఫ్లెబో వస్తున్నారు",
      arrivedBadge: "ఇంటి వద్దకు వచ్చారు",
      callPhlebo: "ఫ్లెబోకు కాల్ చేయండి",
      whatsapp: "వాట్సాప్",
      atDoorstep: "మీ ఇంటి వద్ద ఉన్నారు",
      minsAway: (mins) => `~${mins} నిమిషాల్లో`,
      kmAway: (km) => `${km} కి.మీ దూరంలో`,
      otpTitle: "ఈ OTPని ఫ్లెబోటోమిస్ట్‌తో పంచుకోండి",
      otpDesc: "స్టెరైల్, ట్యాంపర్-ఎవిడెంట్ వాక్యుటైనర్ ట్యూబ్‌లతో ఫ్లెబోటోమిస్ట్ వచ్చినప్పుడు మాత్రమే ఈ కోడ్‌ను పంచుకోండి.",
      sterileSeal: "స్టెరైల్ వాక్యూమ్ సీల్ హామీ",
      steps: {
        confirmed: "నిర్ధారించబడింది",
        search: "ఫ్లెబో అన్వేషణ",
        enRoute: "వస్తున్నారు",
        arrived: "చేరుకున్నారు",
        inLab: "ల్యాబ్‌లో నమూనా",
      },
      vaccinated: "100% వ్యాక్సిన్ చేయబడింది",
      sterileKits: "స్టెరైల్ సింగిల్-యూజ్ కిట్‌లు",
      tempBox: "2°C–8°C ఉష్ణోగ్రత నియంత్రిత బాక్స్",
    },
    kpi: {
      upcoming: "రాబోయే నియామకాలు",
      upcomingSub: "షెడ్యూల్ చేసిన బుకింగ్‌లు",
      completed: "పూర్తయిన సేవలు",
      completedSub: "అందించిన గత సంరక్షణ",
      prescriptions: "క్రియాశీల ప్రిస్క్రిప్షన్లు",
      prescriptionsSub: "రెగ్యులర్ మందులు",
      records: "ఆరోగ్య రికార్డులు",
      recordsSub: "డయాగ్నస్టిక్ ల్యాబ్ నివేదికలు",
    },
    allottedSlots: {
      title: "స్లాట్ కేటాయింపు నోటిఫికేషన్లు",
      pendingCount: (count) => `${count} పెండింగ్‌లో ఉన్నాయి`,
      timeAllotted: "సమయ స్లాట్ కేటాయించబడింది",
      accept: "అంగీకరించు",
      decline: "తిరస్కరించు",
    },
    quickActions: {
      title: "త్వరిత చర్యలు",
      subtitle: "తక్షణ ఇంటి వద్ద ఆరోగ్య సంరక్షణ & టెలిమెడిసిన్",
      urgentHomeCollection: "అత్యవసర హోమ్ నమూనా సేకరణ",
      urgentHomeCollectionSub: "15–30 నిమిషాల్లో మీ ఇంటి వద్ద సర్టిఫైడ్ ఫ్లెబోటోమిస్ట్.",
      urgentHomeCollectionTag: "ఉచిత హోమ్ విజిట్ · NABL ల్యాబ్",
      urgentHomeDoctor: "అత్యవసర హోమ్ డాక్టర్",
      urgentHomeDoctorSub: "MBBS / MD ఫిజిషియన్ శారీరక పరీక్ష & ప్రిస్క్రిప్షన్.",
      urgentHomeDoctorTag: "ధృవీకరించబడిన వైద్యుడు",
      urgentHomeNurse: "అత్యవసర హోమ్ నర్స్",
      urgentHomeNurseSub: "IV డ్రిప్, గాయం డ్రెస్సింగ్, వైటల్స్ చెక్ & సర్జరీ తర్వాతి సంరక్షణ.",
      urgentHomeNurseTag: "B.Sc నర్సింగ్ సర్టిఫైడ్",
      urgentPharmacy: "అత్యవసర మందుల డెలివరీ",
      urgentPharmacySub: "80% జెనరిక్ పొదుపుతో సమీప ఫార్మసీ డెలివరీ.",
      urgentPharmacyTag: "45 నిమిషాల లోపు",
      homeDietitian: "హోమ్ డైటీషియన్ & న్యూట్రిషన్",
      homeDietitianSub: "ఇంటి వద్దే పోషకాహార ఆడిట్, మధుమేహం MNT & డైట్ చార్ట్.",
      homeDietitianTag: "IDA సర్టిఫైడ్ · ₹800 విజిట్",
      homePhysio: "హోమ్ ఫిజియోథెరపిస్ట్",
      homePhysioSub: "కీళ్ల కదలిక, వెన్నునొప్పి నివారణ & స్ట్రోక్ రికవరీ థెరపీ.",
      homePhysioTag: "MIAP సర్టిఫైడ్ · ₹800 విజిట్",
      videoConsult: "వీడియో కన్సల్టేషన్",
      videoConsultSub: "AI సారాంశంతో 60 సెకన్లలో స్పెషలిస్ట్ డాక్టర్‌తో మాట్లాడండి.",
      videoConsultTag: "తక్షణ HD కనెక్ట్",
      pmjay: "ఆయుష్మాన్ భారత్ ఉచిత బుకింగ్",
      pmjaySub: "ప్రభుత్వ ఆయుష్మాన్ భారత్ ₹5 లక్షల ఉచిత కవరేజ్.",
      pmjayTag: "పూర్తిగా ఉచితం",
      aiReports: "AI నివేదికలు & విశ్లేషణలు",
      aiReportsSub: "సంక్లిష్ట ల్యాబ్ నివేదికల సరళమైన అనువాదం.",
      aiReportsTag: "నెక్స్ట్‌జెన్ లిక్విడ్ AI",
      requesting: "అభ్యర్థిస్తోంది...",
    },
    bookings: {
      title: "ఇటీవలి బుకింగ్‌లు",
      loading: "లోడ్ అవుతోంది...",
      noBookings: "ఇటీవలి బుకింగ్‌లు కనుగొనబడలేదు.",
      bookFirst: "మీ మొదటి సేవను బుక్ చేసుకోండి",
      viewAllHistory: "అన్ని బుకింగ్‌ల చరిత్రను చూడండి",
      trackPhlebo: "ఫ్లెబోను ట్రాక్ చేయండి",
      quickReorder: "త్వరిత రీ-ఆర్డర్",
      cancel: "రద్దు చేయండి",
    },
    abha: {
      title: "ABHA ఆరోగ్య రికార్డులు",
      linked: "ABHA అనుసంధానించబడింది:",
      synced: "మీ ఆరోగ్య రికార్డులు ABDMతో సింక్ చేయబడ్డాయి.",
      notLinkedDesc: "ఏదైనా ABDM-నమోదిత సౌకర్యం నుండి మీ పూర్తి ఆరోగ్య చరిత్రను పొందడానికి మీ ABHAని లింక్ చేయండి.",
      manageBtn: "ABHA ఖాతాను నిర్వహించండి",
    },
    reorderModal: {
      title: "త్వరిత పునఃఆర్డర్ నిర్ధారణ",
      subtitle: "1 క్లిక్‌తో మీ గత పరీక్ష ప్యాకేజీ లేదా ప్రిస్క్రిప్షన్ ఆర్డర్‌ను మళ్లీ బుక్ చేసుకోండి:",
      estimatedPrice: "అంచనా వేసిన ధర:",
      cancel: "రద్దు చేయండి",
      confirm: "నిర్ధారించండి & మళ్లీ ఆర్డర్ చేయండి",
      processing: "ప్రాసెస్ అవుతోంది...",
    },
  },

  hi: {
    welcome: "स्वागत है",
    greeting: "यहाँ आज के लिए आपका स्वास्थ्य अवलोकन है",
    bookTest: "सेवा बुक करें",
    familyCaregiverSwitcher: "पारिवारिक देखभालकर्ता स्विचर",
    members: "सदस्य",
    noFamilyMembers: "अभी तक कोई पारिवारिक सदस्य नहीं जोड़ा गया है। प्रोफाइल बदलने के लिए नीचे पारिवारिक सदस्य अनुभाग में जोड़ें।",
    addFamilyHint: "परिवार का सदस्य जोड़ें",
    self: "स्वयं",
    emergencySOSTriage: "आपातकालीन SOS ट्राइएज",
    twentyFourSevenActive: "24/7 सक्रिय",
    sosAlertDesc: (count) => `GPS के साथ ${count} आपातकालीन संपर्कों और कॉलमेडेक्स यूनिट को त्वरित अलर्ट।`,
    triggerEmergencySOS: "आपातकालीन SOS ट्रिगर करें",
    dispatched: "भेज दिया गया!",
    cancel: "रद्द करें",
    emergencySOSBtn: "आपातकालीन SOS",
    emergencyConfirm: "आपातकालीन SOS चेतावनी: यह नजदीकी आपातकालीन डॉक्टरों और एम्बुलेंस सेवाओं को उच्च-प्राथमिकता वाला संकेत भेजेगा। आपका वर्तमान स्थान साझा किया जाएगा। क्या जारी रखें?",
    preventiveBiomarkerMatrix: "निवारक बायोमार्कर मैट्रिक्स",
    biomarkerSubtitle: "फ़ाइल पर लैब अवलोकन। नैदानिक जोखिम व्याख्या के लिए डॉक्टर समीक्षा आवश्यक है।",
    riskCompass: "जोखिम कम्पास",
    timeSeriesTrend: "समय-श्रृंखला रुझान",
    noBiomarkersTitle: "अभी तक कोई लैब बायोमार्कर दर्ज नहीं है",
    noBiomarkersBody: "अपना बायोमार्कर इतिहास और रुझान दृश्य बनाने के लिए डायग्नोस्टिक लैब टेस्ट बुक करें।",
    readingsOnFile: "फ़ाइल पर रीडिंग",
    biomarkersCount: (count) => `${count} बायोमार्कर`,
    smartMedicineCabinet: "स्मार्ट मेडिसिन कैबिनेट और रीफिल रडार",
    medicineCabinetSubtitle: "सक्रिय दवा की गोलियों, दैनिक खुराक और रीफिल तिथियों को ट्रैक करें।",
    addMedication: "दवा जोड़ें",
    noMedicationsTitle: "कैबिनेट में कोई दवा नहीं है",
    noMedicationsBody: "दैनिक खुराक और रीफिल रिमाइंडर ट्रैक करने के लिए अपनी पहली दवा जोड़ें।",
    daysSupplyRemaining: "दिनों की आपूर्ति शेष",
    pillsRemaining: "गोलियाँ शेष",
    refillNeeded: "रीफिल आवश्यक",
    dailyDosage: "दैनिक खुराक",
    reorderMeds: "सभी सक्रिय नुस्खे फिर से ऑर्डर करें",
    sampleStatusTitle: "नमूना प्रगति ट्रैक करें",
    sampleSteps: {
      pending: "संग्रह लंबित",
      collected: "एकत्रित",
      inTransit: "पारगमन में / प्राप्त",
      verified: "सत्यापित",
      sentToLab: "लैब भेजा गया",
    },
    actionChips: {
      aiVoice: "एआई वॉयस स्क्राइब व ट्राइएज",
      drugShield: "ड्रगशील्ड एआई (80% जेनेरिक बचत)",
      phleboDemo: "फ्लेबो डिस्पैच (डेमो)",
      phleboHide: "डेमो ट्रैकर छिपाएं",
      doctorBriefing: "एआई डॉक्टर ब्रीफिंग (PDF / QR)",
    },
    rapido: {
      title: "कॉलमेडेक्स रैपिडो फ्लेबो डिस्पैच",
      sampleData: "नमूना डेटा",
      searchingSubtitle: "आपके डिलीवरी दायरे में सत्यापित फ्लेबोटोमिस्ट से जुड़ रहे हैं...",
      enRouteSubtitle: "फ्लेबोटोमिस्ट तापमान-नियंत्रित कोल्ड चेन नमूना किट के साथ रास्ते में हैं।",
      arrivedSubtitle: "फ्लेबोटोमिस्ट आपके दरवाजे पर हैं। शुरू करने के लिए स्टेरिल ओटीपी साझा करें।",
      broadcastingBadge: "अनुरोध प्रसारित किया जा रहा है",
      enRouteBadge: "फ्लेबो रास्ते में है",
      arrivedBadge: "दरवाजे पर पहुंचे",
      callPhlebo: "फ्लेबो को कॉल करें",
      whatsapp: "व्हाट्सएप",
      atDoorstep: "आपके दरवाजे पर",
      minsAway: (mins) => `~${mins} मिनट में`,
      kmAway: (km) => `${km} किमी दूर`,
      otpTitle: "यह ओटीपी फ्लेबोटोमिस्ट के साथ साझा करें",
      otpDesc: "यह सुरक्षित कोड तभी साझा करें जब फ्लेबोटोमिस्ट स्टेरिल, छेड़छाड़-रोधी वैक्यूटेनर ट्यूबों के साथ आपके दरवाजे पर पहुंचे।",
      sterileSeal: "स्टेरिल वैक्यूम सील आश्वस्त",
      steps: {
        confirmed: "पुष्टि की गई",
        search: "फ्लेबो खोज",
        enRoute: "रास्ते में",
        arrived: "आगमन",
        inLab: "नमूना लैब में",
      },
      vaccinated: "100% टीकाकरण",
      sterileKits: "स्टेरिल एकल-उपयोग किट",
      tempBox: "2°C–8°C तापमान नियंत्रित बॉक्स",
    },
    kpi: {
      upcoming: "आगामी अपॉइंटमेंट",
      upcomingSub: "अनुसूचित बुकिंग",
      completed: "पूर्ण की गई सेवाएँ",
      completedSub: "जीवनकाल में प्रदान की गई देखभाल",
      prescriptions: "सक्रिय नुस्खे",
      prescriptionsSub: "दैनिक दवाएं",
      records: "स्वास्थ्य रिकॉर्ड",
      recordsSub: "डायग्नोस्टिक लैब रिपोर्ट",
    },
    allottedSlots: {
      title: "स्लॉट आवंटन सूचनाएं",
      pendingCount: (count) => `${count} लंबित`,
      timeAllotted: "समय स्लॉट आवंटित",
      accept: "स्वीकार करें",
      decline: "अस्वीकार करें",
    },
    quickActions: {
      title: "त्वरित कार्य",
      subtitle: "तत्काल घर पर स्वास्थ्य सेवा और टेलीमेडिसिन",
      urgentHomeCollection: "तत्काल गृह नमूना संग्रह",
      urgentHomeCollectionSub: "15-30 मिनट में आपके दरवाजे पर प्रमाणित फ्लेबोटोमिस्ट।",
      urgentHomeCollectionTag: "मुफ्त गृह दौरा · NABL लैब",
      urgentHomeDoctor: "तत्काल गृह डॉक्टर",
      urgentHomeDoctorSub: "एमबीबीएस / एमडी चिकित्सक द्वारा शारीरिक जांच और नुस्खा।",
      urgentHomeDoctorTag: "सत्यापित चिकित्सक",
      urgentHomeNurse: "तत्काल गृह नर्स",
      urgentHomeNurseSub: "आईवी ड्रिप, घाव की पट्टी, वाइटल्स जांच और सर्जरी पश्चात देखभाल।",
      urgentHomeNurseTag: "बी.एससी नर्सिंग प्रमाणित",
      urgentPharmacy: "तत्काल दवा वितरण",
      urgentPharmacySub: "80% जेनेरिक बचत के साथ त्वरित फार्मेसी डिलीवरी।",
      urgentPharmacyTag: "45 मिनट के भीतर",
      homeDietitian: "गृह आहार विशेषज्ञ व पोषण",
      homeDietitianSub: "घर पर पोषण संबंधी ऑडिट, मधुमेह एमएनटी और आहार चार्ट।",
      homeDietitianTag: "आईडीए प्रमाणित · ₹800 दौरा",
      homePhysio: "गृह फिजियोथेरेपिस्ट",
      homePhysioSub: "जोड़ों का संचालन, रीढ़ का पुनर्वास और स्ट्रोक रिकवरी थेरेपी।",
      homePhysioTag: "एमआईएपी प्रमाणित · ₹800 दौरा",
      videoConsult: "वीडियो परामर्श",
      videoConsultSub: "एआई सारांश के साथ 60 सेकंड में विशेषज्ञ डॉक्टर से जुड़ें।",
      videoConsultTag: "त्वरित एचडी कनेक्ट",
      pmjay: "आयुष्मान भारत मुफ्त बुकिंग",
      pmjaySub: "सरकारी आयुष्मान भारत ₹5 लाख कैशलेस कवरेज।",
      pmjayTag: "पूरी तरह से मुफ्त",
      aiReports: "एआई रिपोर्ट और अंतर्दृष्टि",
      aiReportsSub: "जटिल लैब रिपोर्टों का सरल भाषा में त्वरित अनुवाद।",
      aiReportsTag: "नेक्स्टजेन लिक्विड एआई",
      requesting: "अनुरोध भेजा जा रहा है...",
    },
    bookings: {
      title: "हालिया बुकिंग्स",
      loading: "लोड हो रहा है...",
      noBookings: "कोई हालिया बुकिंग नहीं मिली।",
      bookFirst: "अपनी पहली सेवा बुक करें",
      viewAllHistory: "सभी बुकिंग का इतिहास देखें",
      trackPhlebo: "फ्लेबो ट्रैक करें",
      quickReorder: "त्वरित पुनः आदेश",
      cancel: "रद्द करें",
    },
    abha: {
      title: "आभा (ABHA) स्वास्थ्य रिकॉर्ड",
      linked: "आभा लिंक किया गया:",
      synced: "आपके स्वास्थ्य रिकॉर्ड एबीडीएम के साथ सिंक हैं।",
      notLinkedDesc: "किसी भी एबीडीएम-पंजीकृत सुविधा से अपना पूरा स्वास्थ्य इतिहास देखने के लिए अपना आभा लिंक करें।",
      manageBtn: "आभा खाता प्रबंधित करें",
    },
    reorderModal: {
      title: "त्वरित पुनः आदेश पुष्टि",
      subtitle: "1 क्लिक में अपने पिछले टेस्ट पैकेज या नुस्खे के ऑर्डर को फिर से बुक करें:",
      estimatedPrice: "अनुमानित मूल्य:",
      cancel: "रद्द करें",
      confirm: "पुष्टि करें और फिर से ऑर्डर करें",
      processing: "प्रक्रिया जारी है...",
    },
  },
};
