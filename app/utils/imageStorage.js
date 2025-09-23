// // utils/imageStorage.js
// const fs = require('fs').promises;
// const path = require('path');

// // Ensure upload directory exists
// const ensureUploadDir = async (shopName) => {
//   const uploadPath = path.join(process.cwd(), 'public', 'uploads', shopName);
//   try {
//     await fs.access(uploadPath);
//   } catch (error) {
//     await fs.mkdir(uploadPath, { recursive: true });
//   }
//   return uploadPath;
// };

// // Save base64 image to file system
// const saveImage = async (base64Data, shopName, fileName) => {
//   try {
//     // Remove data:image/png;base64, prefix if present
//     const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
//     const uploadPath = await ensureUploadDir(shopName);
//     const filePath = path.join(uploadPath, fileName);
    
//     await fs.writeFile(filePath, base64Image, 'base64');
    
//     // Return relative URL path
//     return `/uploads/${shopName}/${fileName}`;
//   } catch (error) {
//     console.error('Error saving image:', error);
//     throw new Error('Failed to save image');
//   }
// };

// // Delete image from file system
// const deleteImage = async (imageUrl, shopName) => {
//   try {
//     if (!imageUrl) return;
    
//     const fileName = path.basename(imageUrl);
//     const filePath = path.join(process.cwd(), 'public', 'uploads', shopName, fileName);
    
//     await fs.unlink(filePath);
//   } catch (error) {
//     console.error('Error deleting image:', error);
//   }
// };

// module.exports = {
//   saveImage,
//   deleteImage,
//   ensureUploadDir
// };