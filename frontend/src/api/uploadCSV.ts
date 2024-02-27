const uploadCSV = async (file: File): Promise<void> => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}upload-csv/`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (response.ok) {
      console.log("File has been successfully uploaded.");
    } else {
      console.error("There was an error during the file upload.");
    }
  } catch (error) {
    console.error("Error:", error);
  }
};

export default uploadCSV;
