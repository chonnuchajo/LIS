function buildProductionWorkflow(input, petitionNo, now = new Date()) {
  const requestNo = String(input?.requestNo || input?.request_no || '').trim();
  if (!requestNo) return undefined;
  const requesterEmail = String(input?.requesterEmail || input?.requester_email || input?.email || '').trim();
  return {
    requestNo,
    requesterEmail: requesterEmail || undefined,
    lisPetitionNo: petitionNo,
    petitionNo,
    lisStatus: 'sent',
    lisSent: true,
    sentAt: now,
  };
}

module.exports = { buildProductionWorkflow };
