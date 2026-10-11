package expo.modules.jwpocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Nhận dạng chữ trong ảnh ngay trên máy (không cần mạng, không tốn phí).
 * Trả về toàn bộ văn bản + từng dòng kèm toạ độ để JS ghép nhãn với giá trị cùng hàng.
 */
class JwpOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("JwpOcr")

    AsyncFunction("recognize") { uri: String, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        promise.reject("E_OCR_IMAGE", "Không đọc được ảnh: ${e.message}", e)
        return@AsyncFunction
      }

      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      recognizer.process(image)
        .addOnSuccessListener { result ->
          val lines = result.textBlocks.flatMap { block ->
            block.lines.map { line ->
              val box = line.boundingBox
              mapOf(
                "text" to line.text,
                "left" to (box?.left ?: 0),
                "top" to (box?.top ?: 0),
                "right" to (box?.right ?: 0),
                "bottom" to (box?.bottom ?: 0)
              )
            }
          }
          promise.resolve(
            mapOf(
              "text" to result.text,
              "width" to image.width,
              "height" to image.height,
              "lines" to lines
            )
          )
          recognizer.close()
        }
        .addOnFailureListener { e ->
          promise.reject("E_OCR_FAILED", e.message ?: "Nhận dạng chữ thất bại", e)
          recognizer.close()
        }
    }
  }
}
