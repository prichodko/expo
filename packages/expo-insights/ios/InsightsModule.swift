import ExpoModulesCore
import EASClient

/**
 Indicates whether the app launch event has already been sent.
 */
private var wasAppLaunchEventDispatched = false

public final class InsightsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoInsights")

    OnCreate {
      // The app launch event should be sent only during the first launch
      // which means that we need to prevent dispatching them on app reload.
      if !wasAppLaunchEventDispatched {
        wasAppLaunchEventDispatched = true

        Task {
          try await dispatchLaunchEvent()
        }
      }
    }
  }

  /**
   Sends the `APP_LAUNCH` event.
   */
  private func dispatchLaunchEvent() async throws {
    guard let manifest = appContext?.constants?.constants()["manifest"] as? [String: Any] else {
      log.warn("Insights: Unable to read the manifest")
      return
    }
    guard let projectId = getProjectId(manifest: manifest) else {
      log.warn("Insights: Unable to get the project ID")
      return
    }
    let endpointUrl = "https://staging-i.expo.dev/v1/c/\(projectId)"

    guard var urlComponents = URLComponents(string: endpointUrl) else {
      log.warn("Insights: The URL for the HTTP endpoint is invalid: \(endpointUrl)")
      return
    }
    let data = getLaunchEventData(projectId: projectId)

    for (key, value) in data {
      urlComponents.queryItems?.append(
        URLQueryItem(name: key, value: value)
      )
    }

    guard let url = urlComponents.url else {
      log.warn("Insights: Cannot create an URL instance from the given query: \(urlComponents.query)")
      return
    }
    var request = URLRequest(url: url)

    request.httpMethod = "GET"

    try await URLSession.shared.data(for: request)
  }

  private func getLaunchEventData(projectId: String) -> [String: String?] {
    let info = Bundle.main.infoDictionary

    return [
      "event_name": "APP_LAUNCH",
      "eas_client_id": EASClientID.uuid().uuidString,
      "project_id": projectId,
      "app_version": info?["CFBundleVersion"] as? String,
      "platform": "iOS",
      "os_version": UIDevice.current.systemVersion
    ]
  }
}

/**
 Gets the project ID from the manifest.
 */
private func getProjectId(manifest: [String: Any]) -> String? {
  let extra = manifest["extra"] as? [String: Any]
  let eas = extra?["eas"] as? [String: Any]

  return eas?["projectId"] as? String
}
