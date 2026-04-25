import { HfInference } from '@huggingface/inference';
import { NextRequest, NextResponse } from 'next/server';

// Inicializar solo si hay API key
const hf = process.env.HUGGING_FACE_API_KEY 
  ? new HfInference(process.env.HUGGING_FACE_API_KEY)
  : null;

// Tipos
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `Eres el asistente médico virtual de Integra Médica (Sucursal Amealco). Tu objetivo es brindar información precisa sobre servicios, costos y preparaciones, manteniendo siempre un tono empático, profesional y seguro.

Datos de la Clínica:
- Dirección: Privada 20 de Noviembre #110, Colonia Centro, Amealco de Bonfil, Querétaro.
- Teléfono: 448 272 1114.
- Horarios: L-V 8:00 AM - 6:00 PM, Sábados 9:00 AM - 6:00 PM.

Protocolos USG (Preparación):
- Tomar 1L de agua: Pélvico, Renal, Próstata, Vejiga y Abdomen Completo.
- Ayuno: Abdomen completo/superior, Hígado, Vesícula/vías biliares, Bazo y Páncreas.

Catálogo de Precios (MXN):
- Consultas: General/Ginecológica ($700), Papanicolaou ($350).
- Ultrasonidos: Mama ($700), Tiroides ($700), Estructural ($1900).

Reglas:
1. No dar diagnósticos ni recetas.
2. Respuestas breves (máx 4 oraciones).
3. Usar listas para precios.
4. Para agendar: Usar el botón de calendario en pantalla o llamar al 448 272 1114.
5. Si no está listado, pedir que llamen al número proporcionado.`;

export async function POST(req: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    // Si no hay API key o falla, usar respuestas predefinidas
    if (!hf) {
      return getPredefinedResponse(message.toLowerCase());
    }

    // Intentar con modelos gratuitos
    try {
      // Modelos gratuitos disponibles (prueba en orden)
      const freeModels = [
        'google/flan-t5-xxl',           // Gratuito, bueno para instrucciones
        'microsoft/DialoGPT-medium',    // Gratuito para chat
        'bigscience/bloom-560m',        // Gratuito, ligero
        'gpt2',                         // Siempre disponible
      ];

      let lastError: any = null;
      
      for (const model of freeModels) {
        try {
          console.log(`Intentando con modelo: ${model}`);
          
          const fullPrompt = `${SYSTEM_PROMPT}\n\nPregunta: ${message}\nRespuesta:`;
          
          const response = await hf.textGeneration({
            model: model,
            inputs: fullPrompt,
            parameters: {
              max_new_tokens: 200,
              temperature: 0.3,
              top_p: 0.95,
              do_sample: true,
            },
          });

          if (response.generated_text) {
            let assistantMessage = response.generated_text
              .replace(fullPrompt, '')
              .trim()
              .split('\n')[0]; // Tomar solo la primera línea

            if (assistantMessage.length > 50) { // Validar que haya respuesta útil
              return NextResponse.json({
                response: assistantMessage,
                model: model,
              });
            }
          }
        } catch (modelError) {
          lastError = modelError;
          console.log(`Modelo ${model} falló, probando siguiente...`);
          continue;
        }
      }

      // Si todos los modelos fallan
      console.error('Todos los modelos fallaron:', lastError);
      return getPredefinedResponse(message.toLowerCase());

    } catch (hfError) {
      console.error('Error con Hugging Face:', hfError);
      return getPredefinedResponse(message.toLowerCase());
    }

  } catch (error: any) {
    console.error('Error general:', error);
    return getPredefinedResponse('');
  }
}

// Función para respuestas predefinidas inteligentes
function getPredefinedResponse(userMessage: string): NextResponse {
  const lowerMessage = userMessage.toLowerCase();
  
  // Respuesta por defecto
  let response = `¡Hola! Soy el asistente de Integra Médica Amealco. 

Para agendar una cita puedes usar el botón de calendario en tu pantalla o llamarnos al 448 272 1114. Estamos ubicados en Privada 20 de Noviembre #110, Colonia Centro.

¿Hay algún estudio específico del que desees saber el precio o preparación?`;

  // Respuestas específicas basadas en palabras clave
  if (lowerMessage.includes('horario') || lowerMessage.includes('hora') || lowerMessage.includes('cuándo')) {
    response = `📅 **Horarios de Atención:**
• Lunes a Viernes: 8:00 AM - 6:00 PM
• Sábados: 9:00 AM - 6:00 PM
• Domingos: Cerrado

📍 Dirección: Privada 20 de Noviembre #110, Colonia Centro, Amealco.
📞 Teléfono: 448 272 1114

Para agendar tu cita, usa el botón de calendario en pantalla o llámanos.`;
  }
  
  else if (lowerMessage.includes('precio') || lowerMessage.includes('costo') || lowerMessage.includes('cuánto cuesta')) {
    response = `💰 **Precios de Servicios (MXN):**

**Consultas:**
• Consulta General/Ginecológica: $700
• Papanicolaou: $350

**Ultrasonidos:**
• Mama: $700
• Tiroides: $700
• Estructural: $1900

¿Te interesa algún estudio en particular o necesitas más información sobre preparaciones?`;
  }
  
  else if (lowerMessage.includes('preparación') || lowerMessage.includes('ayuno') || lowerMessage.includes('agua')) {
    response = `🧪 **Preparación para Ultrasonidos:**

**Con 1 litro de agua (2 horas antes):**
• Pélvico
• Renal
• Próstata
• Vejiga
• Abdomen Completo

**Con ayuno (8-12 horas):**
• Abdomen completo/superior
• Hígado
• Vesícula/vías biliares
• Bazo
• Páncreas

¿Para qué estudio necesitas la preparación específica?`;
  }
  
  else if (lowerMessage.includes('ubicación') || lowerMessage.includes('dirección') || lowerMessage.includes('dónde')) {
    response = `📍 **Ubicación:**
Privada 20 de Noviembre #110
Colonia Centro
Amealco de Bonfil, Querétaro

📞 **Teléfono:** 448 272 1114

**Horarios:**
• L-V: 8:00 AM - 6:00 PM
• Sábados: 9:00 AM - 6:00 PM

¿Necesitas ayuda con algo más?`;
  }
  
  else if (lowerMessage.includes('cita') || lowerMessage.includes('agendar') || lowerMessage.includes('reservar')) {
    response = `📅 **Para agendar tu cita:**

1. **Por teléfono:** Llámanos al 448 272 1114
2. **En persona:** Visítanos en Privada 20 de Noviembre #110, Colonia Centro
3. **En línea:** Usa el botón de calendario en esta pantalla

**Horarios disponibles:**
• Lunes a Viernes: 8:00 AM - 6:00 PM
• Sábados: 9:00 AM - 6:00 PM

¿Para qué servicio te gustaría agendar?`;
  }
  
  else if (lowerMessage.includes('consulta') || lowerMessage.includes('doctor') || lowerMessage.includes('médico')) {
    response = `👩‍⚕️ **Servicios de Consulta:**
• Consulta General: $700
• Consulta Ginecológica: $700
• Papanicolaou: $350

**Horarios de consulta:**
Lunes a Viernes: 8:00 AM - 6:00 PM
Sábados: 9:00 AM - 6:00 PM

¿Te gustaría agendar una consulta o necesitas más información?`;
  }

  return NextResponse.json({
    response: response,
    fallback: true,
    suggested: "Usa palabras como: horarios, precios, preparación, ubicación o citas para respuestas específicas."
  }, { status: 200 });
}