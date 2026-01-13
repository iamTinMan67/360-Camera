/**
 * File.io API integration
 * Uploads files to file.io cloud storage
 * Documentation: https://www.file.io/developers
 */

export const uploadToFileIO = async (file, options = {}) => {
  try {
    const formData = new FormData()
    formData.append('file', file)

    // Optional parameters
    if (options.expires) {
      formData.append('expires', options.expires) // ISO 8601 date string
    }
    if (options.maxDownloads) {
      formData.append('maxDownloads', options.maxDownloads.toString())
    }
    if (options.autoDelete !== undefined) {
      formData.append('autoDelete', options.autoDelete.toString())
    }

    const response = await fetch('https://file.io', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.success) {
      return {
        success: true,
        link: data.link,
        key: data.key,
        expiry: data.expiry || null
      }
    } else {
      throw new Error(data.message || 'Upload failed')
    }
  } catch (error) {
    console.error('File.io upload error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Upload multiple files to file.io
 */
export const uploadMultipleToFileIO = async (files, options = {}) => {
  const uploadPromises = files.map(file => uploadToFileIO(file, options))
  const results = await Promise.all(uploadPromises)
  
  return results.map((result, index) => ({
    file: files[index],
    ...result
  }))
}
