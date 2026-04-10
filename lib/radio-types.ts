/** Transmisión sin coordenadas (JSON estático o futura tabla). */
export interface RadioTransmission {
  type: "transmission"
  id: string
  frequency: number
  isLoop: boolean
  audioUrl: string
  title?: string
}

export interface RadioTransmissionsFile {
  transmissions: RadioTransmission[]
}
