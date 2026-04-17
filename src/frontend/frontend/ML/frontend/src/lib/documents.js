export async function uploadProcessDocuments({
  processoId,
  files,
  tipoDocumento,
  supabase,
}) {
  const results = [];

  for (const file of files) {
    const filePath = `processos/${processoId}/${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos_processuais")
      .upload(filePath, file, {
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: documentRow, error: insertError } = await supabase
      .from("documentos")
      .insert({
        processo_id: processoId,
        tipo_documento: tipoDocumento,
        nome_arquivo: file.name,
        caminho_storage: filePath,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    results.push(documentRow);
  }

  return results;
}
