// ── In-Memory Store for Demo & Offline Fallback ───────────────────────
const defaultData = require('./defaultData');

let memMembers = [...defaultData];

let memProfiles = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@teamprofilehub.com',
    name: 'System Admin',
    role: 'ADMIN',
    created_at: new Date().toISOString()
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'member@teamprofilehub.com',
    name: 'Demo Member',
    role: 'MEMBER',
    created_at: new Date().toISOString()
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'chaturvediakarsh51@gmail.com',
    name: 'Akarsh Chaturvedi',
    role: 'ADMIN',
    created_at: new Date().toISOString()
  }
];

let memPending = [];

let memAudit = [
  {
    id: 1,
    action_type: 'system_init',
    actor: 'system',
    target_record: 'system',
    before_value: null,
    after_value: { status: 'initialized' },
    timestamp: new Date().toISOString()
  }
];

// Helper function for in-memory audit logging
function logAuditInMemory(actionType, actor, targetRecord, beforeVal = null, afterVal = null) {
  const logEntry = {
    id: memAudit.length + 1,
    action_type: actionType,
    actor: actor || 'system',
    target_record: targetRecord ? String(targetRecord) : '',
    before_value: beforeVal,
    after_value: afterVal,
    timestamp: new Date().toISOString()
  };
  memAudit.unshift(logEntry);
  return logEntry;
}

module.exports = {
  getMemMembers: () => memMembers,
  setMemMembers: (newVal) => { memMembers = newVal; },

  getMemProfiles: () => memProfiles,
  setMemProfiles: (newVal) => { memProfiles = newVal; },

  getMemPending: () => memPending,
  setMemPending: (newVal) => { memPending = newVal; },

  getMemAudit: () => memAudit,
  setMemAudit: (newVal) => { memAudit = newVal; },

  logAuditInMemory
};
