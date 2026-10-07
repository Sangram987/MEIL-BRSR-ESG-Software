import apiClient from './apiClient';

const getErrorMessage = (
  error,
  fallback
) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;


const mapDocument = (
  doc
) => ({
  id: doc.id,
  name:
    doc.filename ||
    doc.originalFilename ||
    'Document',
  mimeType:
    doc.mimeType ||
    doc.mime_type ||
    '',
  size:
    doc.sizeBytes ||
    doc.size_bytes ||
    0,
  sha256:
    doc.sha256 || '',
  uploadedAt:
    doc.uploadedAt ||
    null,
});


export const evidenceApi = {

  async uploadDocument(
    file
  ) {
    try {
      const formData =
        new FormData();

      formData.append(
        'file',
        file
      );

      const response =
        await apiClient.post(
          '/documents',
          formData
        );

      return mapDocument(
        response.data
      );
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to upload evidence.'
        )
      );
    }
  },


  async downloadDocument(
    documentId
  ) {
    try {
      const response =
        await apiClient.get(
          `/documents/${documentId}`,
          {
            responseType:
              'blob',
          }
        );

      return response.data;
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to download evidence.'
        )
      );
    }
  },


  async linkDocumentToValue(
    documentId,
    esgValueId,
    description = ''
  ) {
    try {
      const response =
        await apiClient.post(
          `/documents/${documentId}/link`,
          {
            esgValueId,
            description,
          }
        );

      return response.data;
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to link evidence to the ESG value.'
        )
      );
    }
  },
};


export default evidenceApi;