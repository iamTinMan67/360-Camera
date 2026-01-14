import { supabase } from '../config/supabase'

/**
 * Upload media to Supabase Storage and create a media record
 * @param {File} file - The file to upload
 * @param {string} supabaseEventId - The Supabase event UUID
 * @param {string} type - 'photo' or 'video'
 * @returns {Promise<{success: boolean, publicUrl?: string, error?: string}>}
 */
export async function uploadMediaToSupabase(file, supabaseEventId, type) {
  if (!supabaseEventId) {
    return { success: false, error: 'No Supabase event ID available' }
  }

  try {
    // Generate a unique filename
    const timestamp = Date.now()
    const extension = type === 'photo' ? 'jpg' : (file.name.split('.').pop() || 'webm')
    const filename = `${type}-${timestamp}.${extension}`
    const storagePath = `${supabaseEventId}/${filename}`

    // Upload to Supabase Storage (bucket: 'event-media')
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('event-media')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError)
      return { success: false, error: uploadError.message }
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('event-media')
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl

    // Create media record in database
    const { data: mediaData, error: mediaError } = await supabase
      .from('media')
      .insert({
        event_id: supabaseEventId,
        type: type,
        storage_path: storagePath,
        public_url: publicUrl
      })
      .select('id')
      .single()

    if (mediaError) {
      console.error('Supabase media record creation error:', mediaError)
      // Try to clean up the uploaded file
      await supabase.storage.from('event-media').remove([storagePath])
      return { success: false, error: mediaError.message }
    }

    return {
      success: true,
      publicUrl: publicUrl,
      mediaId: mediaData.id
    }
  } catch (error) {
    console.error('Error uploading media to Supabase:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}
