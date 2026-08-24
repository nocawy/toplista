// api/uploadCSV.ts
import apiClient from "./apiClient";

const uploadCSV = async (file: File, slug: string): Promise<void> => {
  const formData = new FormData();
  formData.append("file", file);
  await apiClient.post(`upload-csv/?list=${encodeURIComponent(slug)}`, formData);
};

export default uploadCSV;
