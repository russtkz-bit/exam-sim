// CompTIA Security+ SY0-701 official exam structure (domains, weights, objectives).
export const EXAM_INFO = {
  code: "SY0-701",
  name: "CompTIA Security+ SY0-701",
  fullExamQuestions: 90,
  fullExamMinutes: 90,
  passingScaledScore: 750,
  scaledScoreRange: [100, 900],
};

export const DOMAINS = [
  {
    id: "1.0",
    name: "General Security Concepts",
    weight: 12,
    objectives: [
      { id: "1.1", title: "Compare and contrast various types of security controls" },
      { id: "1.2", title: "Summarize fundamental security concepts" },
      { id: "1.3", title: "Explain the importance of change management processes and the impact to security" },
      { id: "1.4", title: "Explain the importance of using appropriate cryptographic solutions" },
    ],
  },
  {
    id: "2.0",
    name: "Threats, Vulnerabilities, and Mitigations",
    weight: 22,
    objectives: [
      { id: "2.1", title: "Compare and contrast common threat actors and motivations" },
      { id: "2.2", title: "Explain common threat vectors and attack surfaces" },
      { id: "2.3", title: "Explain various types of vulnerabilities" },
      { id: "2.4", title: "Given a scenario, analyze indicators of malicious activity" },
      { id: "2.5", title: "Explain the purpose of mitigation techniques used to secure the enterprise" },
    ],
  },
  {
    id: "3.0",
    name: "Security Architecture",
    weight: 18,
    objectives: [
      { id: "3.1", title: "Compare and contrast security implications of different architecture models" },
      { id: "3.2", title: "Given a scenario, apply security principles to secure enterprise infrastructure" },
      { id: "3.3", title: "Compare and contrast concepts and strategies to protect data" },
      { id: "3.4", title: "Explain the importance of resilience and recovery in security architecture" },
    ],
  },
  {
    id: "4.0",
    name: "Security Operations",
    weight: 28,
    objectives: [
      { id: "4.1", title: "Given a scenario, apply common security techniques to computing resources" },
      { id: "4.2", title: "Explain the security implications of proper hardware, software, and data asset management" },
      { id: "4.3", title: "Explain various activities associated with vulnerability management" },
      { id: "4.4", title: "Explain security alerting and monitoring concepts and tools" },
      { id: "4.5", title: "Given a scenario, modify enterprise capabilities to enhance security" },
      { id: "4.6", title: "Given a scenario, implement and maintain identity and access management" },
      { id: "4.7", title: "Explain the importance of automation and orchestration related to secure operations" },
      { id: "4.8", title: "Explain appropriate incident response activities" },
      { id: "4.9", title: "Given a scenario, use data sources to support an investigation" },
    ],
  },
  {
    id: "5.0",
    name: "Security Program Management and Oversight",
    weight: 20,
    objectives: [
      { id: "5.1", title: "Summarize elements of effective security governance" },
      { id: "5.2", title: "Explain elements of the risk management process" },
      { id: "5.3", title: "Explain the processes associated with third-party risk assessment and management" },
      { id: "5.4", title: "Summarize elements of effective security compliance" },
      { id: "5.5", title: "Explain types and purposes of audits and assessments" },
      { id: "5.6", title: "Given a scenario, implement security awareness practices" },
    ],
  },
];

// Flat lookup: "2.4" -> { domainId, domainName, title }
export const OBJECTIVE_INDEX = {};
for (const domain of DOMAINS) {
  for (const obj of domain.objectives) {
    OBJECTIVE_INDEX[obj.id] = {
      domainId: domain.id,
      domainName: domain.name,
      title: obj.title,
    };
  }
}

export function allObjectiveIds() {
  return Object.keys(OBJECTIVE_INDEX);
}

export function domainOfObjective(objId) {
  const entry = OBJECTIVE_INDEX[objId];
  return entry ? entry.domainId : null;
}
