/**
 * VERIGRAPH Forensics, Trust Score, and Evidence API Client.
 * Connects React UI to backend:
 *   - /evidence/quality-check
 *   - /evidence/upload-and-verify
 *   - /evidence/facts
 *   - /evidence/trust-scores
 *   - /evidence/verifications
 *   - /evidence/knowledge-graph
 */
import apiClient from './apiClient';

export const verigraphApi = {
  /**
   * Run computer-vision quality check on evidence before final upload
   */
  async qualityCheck(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/evidence/quality-check', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Complete automated evidence ingestion & forensic verification pipeline
   */
  async uploadAndVerify(file, { projectId, metricCode, reportedValue, reportingPeriodId }) {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId) formData.append('projectId', projectId);
    if (reportingPeriodId) formData.append('reportingPeriodId', reportingPeriodId);
    if (metricCode) formData.append('metricCode', metricCode);
    if (reportedValue !== undefined && reportedValue !== null && String(reportedValue).trim() !== '') {
      formData.append('reportedValue', String(reportedValue));
    }

    const response = await apiClient.post('/evidence/upload-and-verify', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Fetch extracted facts (invoice numbers, quantities, GSTINs, bounding boxes)
   */
  async getFacts(params = {}) {
    const response = await apiClient.get('/evidence/facts', { params });
    return response.data;
  },

  /**
   * Fetch Trust Scores and breakdown
   */
  async getTrustScores(params = {}) {
    const response = await apiClient.get('/evidence/trust-scores', { params });
    return response.data;
  },

  /**
   * Fetch multi-stage verification logs
   */
  async getVerifications() {
    const response = await apiClient.get('/evidence/verifications');
    return response.data;
  },

  /**
   * Fetch knowledge graph nodes and edges
   */
  async getKnowledgeGraph() {
    const response = await apiClient.get('/evidence/knowledge-graph');
    return response.data;
  },

  /**
   * Upload multiple evidence files as an automated batch
   */
  async createBatch(files, { projectId, reportingPeriodId }) {
    const formData = new FormData();
    if (projectId) formData.append('projectId', projectId);
    if (reportingPeriodId) formData.append('reportingPeriodId', reportingPeriodId);
    for (const f of files) {
      formData.append('files', f);
    }
    const response = await apiClient.post('/evidence/batches', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Get batch status and extracted review items
   */
  async getBatch(batchId) {
    const response = await apiClient.get(`/evidence/batches/${batchId}`);
    return response.data;
  },

  /**
   * List recent evidence batches
   */
  async listBatches(params = {}) {
    const response = await apiClient.get('/evidence/batches', { params });
    return response.data;
  },

  /**
   * Update an extraction item's detected values in the review table
   */
  async updateBatchItem(batchId, itemId, payload) {
    const response = await apiClient.patch(`/evidence/batches/${batchId}/items/${itemId}`, payload);
    return response.data;
  },

  /**
   * Remove an item from the batch
   */
  async deleteBatchItem(batchId, itemId) {
    const response = await apiClient.delete(`/evidence/batches/${batchId}/items/${itemId}`);
    return response.data;
  },

  /**
   * Retry failed items in a batch
   */
  async retryFailedBatchItems(batchId) {
    const response = await apiClient.post(`/evidence/batches/${batchId}/retry-failed`);
    return response.data;
  },

  /**
   * Commit verified extraction items to ESG submissions, indicators, and 5-agent verification
   */
  async commitBatch(batchId, itemIds = null) {
    const payload = itemIds ? { itemIds } : {};
    const response = await apiClient.post(`/evidence/batches/${batchId}/commit`, payload);
    return response.data;
  },

  /**
   * Run or retrieve 16-step VERIGRAPH automated evidence-to-BRSR demo
   */
  async getDemoPipeline() {
    try {
      const response = await apiClient.get('/evidence/demo-pipeline');
      return response.data;
    } catch {
      return {
        site: { name: 'MEIL Project Site 104 - Zojila Tunnel', bu: 'Tunnels & Transit Division', subsidiary: 'MEIL Infrastructure & Utilities' },
        invoice: { invoiceNumber: 'INV-4821', vendor: 'ABC Fuels Private Limited', quantityLitres: 1250, totalInr: 118750 },
        step2_qualityCheck: { qualityScore: 94, status: 'ACCEPT' },
        step7_trustScore: { score: 82, category: 'High Confidence', breakdown: { provenance: 95, ocrConfidence: 96, extractionConfidence: 94, documentVerification: 100, crossDocumentConsistency: 100, temporalConsistency: 58 } }
      };
    }
  },
};

export default verigraphApi;
