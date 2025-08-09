// api/uploadCSV.ts
import apiClient from "./apiClient";
import { getCurrentRankingSlug } from "./utilRanking";

const uploadCSV = async (file: File): Promise<void> => {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const slug = getCurrentRankingSlug();
    const response = await apiClient.post(`upload-csv/?list=${encodeURIComponent(slug)}`, formData, {});
    console.log("File has been successfully uploaded: ", response.data);
  } catch (error) {
    console.error("There was an error during the file upload:", error);
  }
};

export default uploadCSV;
